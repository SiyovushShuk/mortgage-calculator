import { useMemo, type ReactNode } from 'react'
import katex from 'katex'

function Formula({
  latex,
  displayMode,
}: {
  latex: string
  displayMode?: boolean
}) {
  const html = useMemo(() => {
    return katex.renderToString(latex, {
      displayMode: displayMode ?? true,
      throwOnError: false,
      strict: 'ignore',
    })
  }, [displayMode, latex])

  return <div className="katexBlock" dangerouslySetInnerHTML={{ __html: html }} />
}

function HelpItem({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <details className="helpItem">
      <summary className="helpItemSummary">{title}</summary>
      <div className="helpItemBody">{children}</div>
    </details>
  )
}

export default function FormulasHelp() {
  return (
    <section className="panel helpPanel">
      <details className="helpRoot">
        <summary className="helpRootSummary">Как это считается?</summary>
        <div className="helpRootBody">
          <div className="helpIntro">
            Здесь приведены формулы, по которым считаются показатели в калькуляторе.
          </div>

          <div className="helpList">
            <HelpItem title="1. Аннуитетный платёж">
              <Formula latex={String.raw`P = S \cdot \frac{i(1+i)^n}{(1+i)^n - 1}`} />
              <ul className="helpBullets">
                <li>P — ежемесячный платёж (одинаков весь срок)</li>
                <li>S — тело кредита (сумма ипотеки минус первоначальный взнос)</li>
                <li>i — месячная ставка (годовая / 100 / 12)</li>
                <li>n — срок кредита в месяцах</li>
              </ul>
              <div className="helpText">
                Платёж постоянный, но соотношение процентов и основного долга внутри него
                меняется: в начале больше процентов, к концу — больше погашения долга.
              </div>
            </HelpItem>

            <HelpItem title="2. Дифференцированный платёж">
              <Formula
                latex={
                  String.raw`\begin{aligned}
\text{Осн}_k &= \frac{S}{n} \\
\text{Пр}_k &= \left( S - \text{Осн}_k \cdot (k-1) \right) \cdot i \\
P_k &= \text{Осн}_k + \text{Пр}_k
\end{aligned}`
                }
              />
              <ul className="helpBullets">
                <li>P_k — платёж в месяце k</li>
                <li>Осн_k — часть основного долга (одинакова каждый месяц)</li>
                <li>Пр_k — проценты на остаток долга в месяце k</li>
                <li>k — номер месяца (от 1 до n)</li>
              </ul>
              <div className="helpText">
                Основной долг гасится равными частями, поэтому платёж максимален в первый
                месяц и постепенно уменьшается к концу срока.
              </div>
            </HelpItem>

            <HelpItem title="3. Досрочное погашение — уменьшение срока">
              <Formula
                latex={
                  String.raw`\text{Остаток}_{k} = \text{Остаток}_{k-1} - \text{Осн}_k - \text{Доп}`
                }
              />
              <div className="helpText">
                Обязательный платёж (P или P_k) остаётся тем же, но благодаря ежемесячной
                доплате Доп остаток долга уменьшается быстрее — кредит закрывается раньше
                исходного срока n.
              </div>
            </HelpItem>

            <HelpItem title="4. Досрочное погашение — уменьшение платежа">
              <Formula
                latex={
                  String.raw`\begin{aligned}
P_{\text{текущий}} &= \text{Остаток} \cdot \frac{i(1+i)^m}{(1+i)^m - 1} \qquad \text{(аннуитет)} \\
\text{Осн}_{\text{текущий}} &= \frac{\text{Остаток}}{m} \qquad \text{(дифференцированный)}
\end{aligned}`
                }
              />
              <div className="helpText">
                m — количество оставшихся месяцев до конца исходного срока. Платёж
                пересчитывается каждый месяц от текущего остатка долга, поэтому он
                постепенно снижается. При достаточно большой доплате кредит может закрыться
                раньше исходного срока.
              </div>
            </HelpItem>

            <HelpItem title="5. ПДН и необходимый доход">
              <Formula
                latex={
                  String.raw`\text{ПДН} = \frac{\text{Сумма всех ежемесячных платежей}}{\text{Ежемесячный доход}} \times 100\%`
                }
              />
              <div className="helpText">
                В калькуляторе решается обратная задача: какой доход нужен, чтобы платёж не
                превышал порог ПДН.
              </div>
              <Formula
                latex={
                  String.raw`\text{Необходимый доход} = \frac{P_{\text{для расчёта}} + \text{Другие платежи}}{\text{Порог ПДН} / 100}`
                }
              />
              <ul className="helpBullets">
                <li>
                  P_для расчёта — P (аннуитет) или P_1 (первый платёж дифференцированного)
                  без учёта доплат по досрочному погашению
                </li>
                <li>Другие платежи — прочие ежемесячные обязательства</li>
                <li>Порог ПДН — максимально допустимая доля дохода</li>
              </ul>
              <div className="helpText">
                Пример: платёж 403 481,63 ¤, другие платежи 15 000 ¤, порог 50%.
              </div>
              <Formula
                latex={
                  String.raw`\text{Необходимый доход} = \frac{403\,481{,}63 + 15\,000}{0{,}5} = 836\,963{,}26\ \text{¤}`
                }
              />
              <div className="helpText">
                Доплата по досрочному погашению — добровольная. Банк при оценке
                платёжеспособности ориентируется на обязательный платёж по графику, поэтому
                в расчёте дохода доплата не учитывается.
              </div>
            </HelpItem>
          </div>
        </div>
      </details>
    </section>
  )
}
