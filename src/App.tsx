import MortgageCalculator from './features/mortgage/MortgageCalculator'
import { CurrencyProvider } from './features/mortgage/currency'

export default function App() {
  return (
    <CurrencyProvider>
      <div className="app">
        <header className="appHeader">
          <h1 className="appTitle">Ипотечный калькулятор</h1>
          <p className="appSubtitle">
            Аннуитетный и дифференцированный платёж, график по месяцам и итоговые
            суммы
          </p>
        </header>
        <main className="appMain">
          <MortgageCalculator />
        </main>
      </div>
    </CurrencyProvider>
  )
}
