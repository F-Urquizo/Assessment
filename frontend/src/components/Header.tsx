import { useGarage } from '../context/GarageContext';

export default function Header() {
  const { cards } = useGarage();

  return (
    <header>
      <div className="masthead-kicker">
        Used-Car Price Estimates · 426,880 Listings Analyzed
      </div>
      <div className="masthead-row">
        <h1>
          BLUEBOOK <em>Studio</em>
        </h1>
        <div className="masthead-right">
          Estimates within <strong>~$3,257</strong> on average
          <br />
          <span>{cards.length ? `Garage · ${cards.length} saved` : 'Garage empty'}</span>
        </div>
      </div>
    </header>
  );
}
