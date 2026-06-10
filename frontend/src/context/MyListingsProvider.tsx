import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Options } from '../types';
import type {
  DealBadge,
  Listing,
  ListingInput,
  ListingStatus,
} from '../lib/marketplace-types';
import {
  createListing,
  deleteListing,
  fetchMyListings,
  updateListing,
} from '../lib/api';
import { useAuth } from './AuthContext';
import {
  MyListingsContext,
  type GarageBridge,
  type MyListingsContextValue,
  type SellField,
  type SellFormValues,
} from './MyListingsContext';

const DEAL_THRESHOLD = 10;

function blankForm(options: Options, email: string): SellFormValues {
  const first = (xs: string[]) => xs[0] ?? '';
  return {
    manufacturer: first(options.manufacturers),
    model: '',
    year: String(options.year_range?.[1] ?? 2020),
    odometer: '40000',
    cylinders:
      options.cylinders[0] != null
        ? String(Math.trunc(Number(options.cylinders[0])))
        : '',
    condition: first(options.conditions),
    fuel: first(options.fuels),
    titleStatus: first(options.title_statuses),
    transmission: first(options.transmissions),
    drive: first(options.drives),
    type: first(options.types),
    paintColor: first(options.paint_colors),
    state: first(options.states),
    askingPrice: '',
    description: '',
    contactEmail: email,
    contactPhone: '',
    status: 'draft',
  };
}

function dealBadgeFor(deltaPct: number | null): DealBadge | null {
  if (deltaPct === null) return null;
  if (deltaPct <= -DEAL_THRESHOLD) return 'under';
  if (deltaPct >= DEAL_THRESHOLD) return 'over';
  return 'fair';
}

type Valuation = {
  predictedValue: number;
  predictedLow: number;
  predictedHigh: number;
} | null;

let tempSeq = 0;

export function MyListingsProvider({
  options,
  children,
}: {
  options: Options;
  children: ReactNode;
}) {
  const { isAuthenticated, accessToken, user } = useAuth();
  const email = user?.email ?? '';

  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [form, setForm] = useState<SellFormValues>(() =>
    blankForm(options, email),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [valuation, setValuation] = useState<Valuation>(null);

  // Hydrate the user's listings; ignore failure (offline / mock auth).
  useEffect(() => {
    let cancelled = false;
    const load = isAuthenticated
      ? fetchMyListings(accessToken).catch(() => [] as Listing[])
      : Promise.resolve<Listing[]>([]);
    load.then((list) => {
      if (!cancelled) setMyListings(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  const setField = useCallback((name: SellField, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const startNew = useCallback(() => {
    setForm(blankForm(options, email));
    setEditingId(null);
    setValuation(null);
  }, [options, email]);

  const startFromGarage = useCallback(
    (car: GarageBridge) => {
      const p = car.payload;
      setForm({
        manufacturer: p.manufacturer,
        model: p.model,
        year: String(p.year),
        odometer: String(p.odometer),
        cylinders: String(p.cylinders),
        condition: p.condition,
        fuel: p.fuel,
        titleStatus: p.title_status,
        transmission: p.transmission,
        drive: p.drive,
        type: p.type,
        paintColor: p.paint_color,
        state: p.state,
        askingPrice: String(Math.round(car.estimate)),
        description: '',
        contactEmail: email,
        contactPhone: '',
        status: 'active',
      });
      setEditingId(null);
      setValuation({
        predictedValue: car.estimate,
        predictedLow: car.low,
        predictedHigh: car.high,
      });
    },
    [email],
  );

  const startEdit = useCallback((listing: Listing) => {
    setForm({
      manufacturer: listing.manufacturer,
      model: listing.model,
      year: String(listing.year),
      odometer: String(listing.odometer),
      cylinders: listing.cylinders != null ? String(listing.cylinders) : '',
      condition: listing.condition,
      fuel: listing.fuel,
      titleStatus: listing.titleStatus,
      transmission: listing.transmission,
      drive: listing.drive,
      type: listing.type,
      paintColor: listing.paintColor,
      state: listing.state,
      askingPrice: String(listing.askingPrice),
      description: listing.description ?? '',
      contactEmail: listing.contactEmail,
      contactPhone: listing.contactPhone ?? '',
      status: listing.status,
    });
    setEditingId(listing.id);
    setValuation(
      listing.predictedValue != null
        ? {
            predictedValue: listing.predictedValue,
            predictedLow: listing.predictedLow ?? listing.predictedValue,
            predictedHigh: listing.predictedHigh ?? listing.predictedValue,
          }
        : null,
    );
  }, []);

  const buildInput = useCallback(():
    | { ok: true; input: ListingInput }
    | { ok: false; error: string } => {
    const askingPrice = Number(form.askingPrice);
    if (!form.model.trim()) return { ok: false, error: 'Model is required' };
    if (!askingPrice || askingPrice < 1)
      return { ok: false, error: 'Enter a valid asking price' };
    if (!form.contactEmail.trim())
      return { ok: false, error: 'Contact email is required' };
    return {
      ok: true,
      input: {
        manufacturer: form.manufacturer,
        model: form.model.trim(),
        year: Number(form.year),
        odometer: Number(form.odometer),
        cylinders: form.cylinders ? Number(form.cylinders) : null,
        condition: form.condition,
        fuel: form.fuel,
        titleStatus: form.titleStatus,
        transmission: form.transmission,
        drive: form.drive,
        type: form.type,
        paintColor: form.paintColor,
        state: form.state,
        askingPrice,
        description: form.description.trim() || null,
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || null,
        status: form.status,
      },
    };
  }, [form]);

  const save = useCallback((): { ok: boolean; error?: string } => {
    const built = buildInput();
    if (!built.ok) return built;
    const input = built.input;

    const predictedValue = valuation?.predictedValue ?? null;
    const dealDeltaPct = predictedValue
      ? Math.round(((input.askingPrice - predictedValue) / predictedValue) * 10000) /
        100
      : null;
    const dealBadge = dealBadgeFor(dealDeltaPct);
    const now = new Date().toISOString();

    if (editingId) {
      setMyListings((prev) =>
        prev.map((l) =>
          l.id === editingId
            ? {
                ...l,
                ...input,
                cylinders: input.cylinders ?? null,
                description: input.description ?? null,
                contactPhone: input.contactPhone ?? null,
                status: input.status ?? l.status,
                predictedValue,
                dealDeltaPct,
                dealBadge,
                updatedAt: now,
              }
            : l,
        ),
      );
      updateListing(editingId, input, accessToken).catch(() => {});
    } else {
      tempSeq += 1;
      const local: Listing = {
        id: `local-${tempSeq}`,
        manufacturer: input.manufacturer,
        model: input.model,
        year: input.year,
        odometer: input.odometer,
        cylinders: input.cylinders ?? null,
        condition: input.condition,
        fuel: input.fuel,
        titleStatus: input.titleStatus,
        transmission: input.transmission,
        drive: input.drive,
        type: input.type,
        paintColor: input.paintColor,
        state: input.state,
        askingPrice: input.askingPrice,
        description: input.description ?? null,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        status: input.status ?? 'draft',
        predictedValue,
        predictedLow: valuation?.predictedLow ?? null,
        predictedHigh: valuation?.predictedHigh ?? null,
        dealDeltaPct,
        dealBadge,
        userId: user?.id ?? 'me',
        createdAt: now,
        updatedAt: now,
      };
      setMyListings((prev) => [local, ...prev]);
      createListing(input, accessToken)
        .then((created) =>
          setMyListings((prev) =>
            prev.map((l) => (l.id === local.id ? created : l)),
          ),
        )
        .catch(() => {});
    }
    startNew();
    return { ok: true };
  }, [buildInput, valuation, editingId, accessToken, user, startNew]);

  const remove = useCallback(
    (id: string) => {
      setMyListings((prev) => prev.filter((l) => l.id !== id));
      deleteListing(id, accessToken).catch(() => {});
    },
    [accessToken],
  );

  const setStatus = useCallback(
    (id: string, status: ListingStatus) => {
      setMyListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l)),
      );
      updateListing(id, { status }, accessToken).catch(() => {});
    },
    [accessToken],
  );

  const value = useMemo<MyListingsContextValue>(
    () => ({
      myListings,
      form,
      editingId,
      setField,
      startNew,
      startFromGarage,
      startEdit,
      save,
      remove,
      setStatus,
    }),
    [
      myListings,
      form,
      editingId,
      setField,
      startNew,
      startFromGarage,
      startEdit,
      save,
      remove,
      setStatus,
    ],
  );

  return (
    <MyListingsContext.Provider value={value}>
      {children}
    </MyListingsContext.Provider>
  );
}
