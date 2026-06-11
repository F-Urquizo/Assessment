import type { ReactNode } from 'react';
import type { Options, TabName } from '../types';
import { ToastProvider } from '../context/ToastProvider';
import { GarageProvider } from '../context/GarageProvider';
import { StudioProvider } from '../context/StudioProvider';
import { useStudio } from '../context/StudioContext';
import Header from './Header';
import Tabs from './Tabs';
import Footer from './Footer';
import AppraiseView from './views/AppraiseView';
import DriversView from './views/DriversView';
import ForecastView from './views/ForecastView';
import DealView from './views/DealView';
import MarketView from './views/MarketView';
import GarageView from './views/GarageView';
import SellView from './views/SellView';

function View({ tab, children }: { tab: TabName; children: ReactNode }) {
  const { activeTab } = useStudio();
  return <section className={'view' + (activeTab === tab ? ' active' : '')}>{children}</section>;
}

function StudioShell() {
  return (
    <>
      <div className="stripes" aria-hidden="true"></div>
      <main className="page">
        <Header />
        <Tabs />
        <View tab="appraise">
          <AppraiseView />
        </View>
        <View tab="drivers">
          <DriversView />
        </View>
        <View tab="forecast">
          <ForecastView />
        </View>
        <View tab="deal">
          <DealView />
        </View>
        <View tab="market">
          <MarketView />
        </View>
        <View tab="garage">
          <GarageView />
        </View>
        <View tab="sell">
          <SellView />
        </View>
        <Footer />
      </main>
    </>
  );
}

export default function Studio({ options }: { options: Options }) {
  return (
    <ToastProvider>
      <GarageProvider>
        <StudioProvider options={options}>
          <StudioShell />
        </StudioProvider>
      </GarageProvider>
    </ToastProvider>
  );
}
