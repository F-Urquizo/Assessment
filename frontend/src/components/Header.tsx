import { useGarage } from '../context/GarageContext';

export default function Header() {
  const { cards } = useGarage();

  return (
    <header>
      <div className="masthead-left">
        <div className="kicker">
          Random-Forest Vehicle Intelligence · 426,880 Listings Indexed
        </div>
        <h1>
          BLUEBOOK <em>’21</em>
        </h1>
      </div>
      <div className="masthead-right">
        Decision Studio · v2
        <br />
        Model R² <strong>0.85</strong> · MAE <strong>$3,257</strong>
        <br />
        <span>{cards.length ? `Garage · ${cards.length} saved` : 'Garage empty'}</span>
      </div>
    </header>
  );
}
