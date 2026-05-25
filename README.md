# PALATA

Atmospheric retro-industrial psychological horror FPS на собственном raycasting-движке в духе DOOM / Wolfenstein 3D / Blood.

Действие — советская психиатрическая больница, под которой скрыт исследовательский комплекс. Главный герой — фембой, который проходит путь от испуганного пациента до хищника: пять состояний восприятия (`medicated`, `withdrawal`, `infected`, `nightmare`, `predator`) переписывают геометрию, аудио, врагов и саму механику игры.

**GitHub Pages:** https://smiley-alyx.github.io/palata/

## Стек

- **TypeScript** — игровая логика и движок.
- **Canvas 2D + raycasting (DDA)** — собственный рендерер.
- **Vite** — dev-server и сборка.
- **Pug** — UI-разметка, прекомпилируется на этапе сборки (рантайм-парсер не входит в bundle).
- **Stylus** — стили, разбитые на модули.

## Запуск

```bash
npm install
npm run dev
```

Vite напечатает адрес локального сервера.

Дополнительно:

```bash
npm run build         # production-сборка
npm run build:gh-pages # сборка с base path /palata/
npm run typecheck
npm run lint
npm run format
```

## Управление

| Клавиша                   | Действие                                |
| ------------------------- | --------------------------------------- |
| `W` `A` `S` `D` / стрелки | Движение и поворот                      |
| `Shift`                   | Подкрадываться                          |
| `Space`                   | Выстрел / удар                          |
| `E`                       | Открыть дверь / взять предмет / читать  |
| `1` `2` `3`               | Труба / пистолет / дробовик             |
| `Q`                       | Циклически переключать оружие           |
| `V`                       | Рывок (доступен в состоянии `predator`) |
| `M`                       | Карта                                   |
| `F`                       | Fullscreen                              |

## Архитектура

Код разбит на два слоя:

- **`src/engine/`**, **`src/raycast/`**, **`src/state/`** — переиспользуемое ядро движка. Не знает про конкретный контент.
- **`src/game/`** — собственно PALATA: системы (доски, враги, perception, инвентарь, оружие, hallucinations, портал-телепорты, predator-абилки и т. д.), уровни, материалы, UI.

UI и ассеты тоже разнесены:

- **`src/game/ui/app.pug`** + **`src/game/ui/partials/*`** — структура страницы (HUD, меню, оверлеи, sidebar).
- **`src/styles/main.styl`** + **`src/styles/parts/*`** — стили по слоям (`_tokens`, `_layout`, `_hud`, `_sidebar`, `_menus`, `_overlays`, `_controls`).
- **`src/game/assets/manifest.ts`** + **`src/game/assets/loader.ts`** — динамический реестр текстур и спрайтов, без статических `<img>` в HTML.

`index.html` — пустой shell с `#app`, всё остальное генерируется и подгружается из TS.

## Формат уровней

`public/assets/data/levels/index.json` — список уровней. Каждый уровень — JSON в той же папке:

- `rows` + `legend` — сетка карты, символы → семантические материалы.
- `materialsWall` — переопределение материалов отдельных стен.
- `spawn` — стартовая позиция.
- `entities` — все динамические объекты (враги, ключи, двери, аптечки, медикаменты, документы, артефакты, патроны, галлюцинации, порталы, амбиент-эмиттеры), с гейтингом по `enabledInStates` / `disabledInStates`.
- `triggers` — зоны, переключающие world-state, ставящие музыку, меняющие материалы и т. п.
- `lights`, `audio`, `colors`, `backgroundMaterials`, `worldStates` — атмосфера и пресет состояния.

## Нарративный документ

`docs/narrative/narrative.txt` — большой документ с концепцией и сюжетом.
`docs/narrative/STATUS.md` — карта соответствия документа коду (что сделано, что partial, что todo).
