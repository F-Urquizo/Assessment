import { useGarage } from '../context/GarageContext';

export default function Header() {
  const { cards } = useGarage();

  return (
    <header>
      <div className="masthead-kicker">
        Random-Forest Vehicle Intelligence · 426,880 Listings Indexed
      </div>
      <div className="masthead-row">
        <h1>
          BLUEBOOK <em>'21</em>
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
