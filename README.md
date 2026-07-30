# Ипотечный калькулятор

Веб-приложение для расчёта ежемесячного ипотечного платежа двумя способами:
аннуитетным и дифференцированным.

Ключевые возможности:
- аннуитетный и дифференцированный тип платежа
- расчёт по кнопке «Посчитать» (результаты не меняются “на лету”)
- live-форматирование сумм в полях ввода (разряды через пробел)
- выбор знака валюты (¤/₿/฿/✦) — влияет только на отображение
- срок кредита: ввод в годах или месяцах (с авто-конвертацией)
- первоначальный взнос: ввод в процентах или суммой (с авто-конвертацией)
- досрочное погашение:
  - с уменьшением срока кредита
  - с уменьшением платежа (срок фиксирован)

## Требования

- Node.js 18+ (рекомендуется)
- npm (идёт вместе с Node.js)

## Установка

```bash
npm install
```

## Запуск в режиме разработки

```bash
npm run dev
```

После запуска приложение доступно по адресу:
- http://localhost:5173/

## Сборка для production

```bash
npm run build
```

Собранные файлы появятся в папке `dist/`.

## Просмотр production-сборки локально

```bash
npm run preview
```

Откройте адрес, который выведется в терминале (обычно это http://localhost:4173/).

## Запуск через Docker (одной командой)

Требования:
- Docker
- Docker Compose

Запуск:

```bash
docker-compose up -d --build
```

Приложение будет доступно по адресу:
- http://localhost:8080/

## Деплой на Vercel

- Залейте проект в GitHub
- На vercel.com создайте New Project и выберите репозиторий
- Vercel сам определит Vite-проект: `npm run build`, папка `dist`
- При каждом push в main Vercel будет автоматически обновлять деплой

## Деплой на GitHub Pages

1) Установите зависимости:

```bash
npm install
```

2) Запустите деплой:

```bash
npm run deploy
```

GitHub Pages поднимет сайт из ветки `gh-pages`.
Один раз включите Pages в репозитории: `Settings → Pages → Source → Branch: gh-pages`.

## Что умеет приложение

- Ввод параметров: стоимость жилья, первоначальный взнос, ставка, срок, тип платежа
- Расчёт:
  - первоначального взноса (в ₽) и тела кредита (S)
  - аннуитетного платежа (фиксированный ежемесячный)
  - дифференцированного платежа (уменьшается по месяцам) + таблица
  - общей суммы выплат и переплаты по процентам
- График платежей/остатка долга по месяцам
- Валидация ввода и форматирование сумм в ₽
- Досрочное погашение:
  - «уменьшение срока»: сравнение «Было / Стало», новый срок и экономия на процентах, график остатка долга
  - «уменьшение платежа»: сравнение «Было / Стало», платёж по месяцам и экономия на процентах

## Структура проекта (основные файлы)

- UI калькулятора: [src/features/mortgage/MortgageCalculator.tsx](src/features/mortgage/MortgageCalculator.tsx)
- Формулы/расчёты: [src/features/mortgage/calc.ts](src/features/mortgage/calc.ts)
- График (SVG): [src/features/mortgage/PaymentChart.tsx](src/features/mortgage/PaymentChart.tsx)
- Форматирование ₽: [src/features/mortgage/format.ts](src/features/mortgage/format.ts)
- Точка входа: [src/main.tsx](src/main.tsx)

## ТЗ

- v1: [mortgage-calculator-prompt.md](mortgage-calculator-prompt.md)
- v2: [mortgage-calculator-prompt-v2.md](mortgage-calculator-prompt-v2.md)
- v3: [mortgage-calculator-prompt-v3.md](mortgage-calculator-prompt-v3.md)
- v4: [mortgage-calculator-prompt-v4.md](mortgage-calculator-prompt-v4.md)
- v5: [mortgage-calculator-prompt-v5.md](mortgage-calculator-prompt-v5.md)
- v6: [mortgage-calculator-prompt-v6.md](mortgage-calculator-prompt-v6.md)
- v7: [mortgage-calculator-prompt-v7.md](mortgage-calculator-prompt-v7.md)
- v8: [mortgage-calculator-prompt-v8.md](mortgage-calculator-prompt-v8.md)
- v9: [mortgage-calculator-prompt-v9.md](mortgage-calculator-prompt-v9.md)
- v10: [mortgage-calculator-prompt-v10.md](mortgage-calculator-prompt-v10.md)
