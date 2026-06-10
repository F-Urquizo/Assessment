import { useStudio } from '../context/StudioContext';
import type { TabName } from '../types';

interface TabDef {
  id: TabName;
  num: string;
  label: string;
  lockable: boolean;
}

const TABS: TabDef[] = [
  { id: 'appraise', num: '01', label: 'Appraise', lockable: false },
  { id: 'drivers', num: '02', label: 'Value drivers', lockable: true },
  { id: 'forecast', num: '03', label: 'Forecast', lockable: true },
  { id: 'deal', num: '04', label: 'Deal check', lockable: true },
  { id: 'market', num: '05', label: 'Market', lockable: true },
  { id: 'garage', num: '06', label: 'Garage', lockable: false },
  { id: 'sell', num: '07', label: 'Sell', lockable: false },
];

export default function Tabs() {
  const { activeTab, setActiveTab, unlocked } = useStudio();

  const go = (id: TabName) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="tabs">
      {TABS.map((tab) => {
        const disabled = tab.lockable && !unlocked;
        return (
          <button
            key={tab.id}
            className={'tab' + (activeTab === tab.id ? ' active' : '')}
            disabled={disabled}
            onClick={() => go(tab.id)}
          >
            <span className="tnum">{tab.num}</span>
            {tab.label}
            {disabled && <span className="lock">🔒</span>}
          </button>
        );
      })}
    </nav>
  );
}
