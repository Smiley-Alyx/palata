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

## Правка уровней

Редактор уровней доступен только в локальных сборках и dev-сервере. В сборке
`npm run build:gh-pages` консольная команда `palata.editor(...)` отключена, поэтому
на GitHub Pages нельзя менять или экспортировать уровни через браузер.

Полная инструкция: [`docs/level-editor.md`](docs/level-editor.md).

Рабочий процесс:

1. Запустить проект локально через `npm run dev`.
2. Открыть редактор из консоли браузера, например `palata.editor("level1")`.
3. Нажать `Save level` в редакторе, чтобы перезаписать файл в `public/assets/data/levels/`.
4. Проверить изменения, сделать коммит и отправить его в репозиторий.
5. Собрать и опубликовать GitHub Pages через `npm run build:gh-pages`.

В редакторе доступны:

- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` и `Ctrl/Cmd+Y` для отмены и повтора правок;
- изменение ширины и высоты карты через панель `Map size`;
- заливка связанной области выбранным типом клетки через инструмент `F Fill area`;
- кнопка `Playtest` сохраняет карту и запускает уровень, а `Back to editor` возвращает в редактор;
- `Ctrl/Cmd+S` для сохранения уровня.

## Управление

| Клавиша                   | Действие                                |
| ------------------------- | --------------------------------------- |
| `W` `A` `S` `D` / стрелки | Движение и поворот                      |
| `Shift`                   | Подкрадываться                          |
| `Space`                   | Выстрел / удар                          |
| `E`                       | Открыть дверь / активировать устройство |
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
- `messagePools` — словари нарративных сообщений уровня, разделённые по категориям (`note`, `card`, `inscription` и т. д.).
- `triggers` — зоны, переключающие world-state, ставящие музыку, меняющие материалы и т. п.
- `lights`, `audio`, `colors`, `backgroundMaterials`, `worldStates` — атмосфера и пресет состояния.

Автоматически срабатывающий источник текста задаётся сущностью `message` (поддерживается
и прежний `note`) с полем `messageType`. При приближении игрока предмет исчезает,
запускает глитч и показывает сообщение без остановки игры. В карте хранится только
категория и внешний вид:

```json
{
  "messagePools": {
    "note": [{ "title": "Записка", "text": "...", "isDocument": true }],
    "card": [{ "title": "Карточка пациента", "text": "...", "isDocument": true }]
  },
  "entities": [
    {
      "id": "note_1",
      "type": "message",
      "messageType": "note",
      "sprite": "document_archive",
      "x": 4.5,
      "y": 8.5
    },
    {
      "id": "card_1",
      "type": "message",
      "messageType": "card",
      "sprite": "document_medical_card",
      "x": 6.5,
      "y": 8.5
    },
    { "id": "silver_key", "type": "key", "subtype": "silver", "x": 9.5, "y": 8.5 }
  ]
}
```

При запуске уровня каждый пул перемешивается и затем расходуется без повторов.
Автоматический подбор любого ключа всегда расходует одно сообщение из категории `note`.
Поэтому
для уровня с семью объектами `messageType: "note"` и тремя ключами пул `note`
должен содержать ровно десять сообщений; для остальных категорий применяется то
же правило. Поля `title` и `text` непосредственно в `note`-сущностях
переопределяют соответствующие поля выбранного сообщения из пула.

## Нарративный документ

`docs/narrative/narrative.txt` — большой документ с концепцией и сюжетом.
`docs/narrative/STATUS.md` — карта соответствия документа коду (что сделано, что partial, что todo).

## Дорожная карта до релиза

Движок и все базовые системы (raycaster, world-states, triggers, lighting,
audio, редактор) готовы. Основной оставшийся объём работы — контент: только
`level1` наполнен полностью, `level2` в процессе, `level3`–`level6` пока
голая геометрия без материалов, света, триггеров и врагов. Ниже — вехи по
порядку и отдельно сводка ассетов, которых не хватает для генерации.

### Вехи

1. **Level 2 «Нижний блок» — довести до готовности.**
   Разметить `materialsWall` по всей карте, свет, триггеры на весь маршрут,
   расставить врагов (`skeleton_husk`, `medical_orderly`, по нарративу можно
   добавить `deformed_patient`), в конце — босс **Привратник**
   (`boss_dade_keeper`).

2. **Level 3 «Кишки комплекса» — наполнить с нуля.**
   Материалы стен/пола на основе органических текстур, свет, триггеры,
   переключение `medicated`/`withdrawal` (первое появление этой механики по
   сюжету), враги `flesh_watcher` и `flesh_eye`, босс **Хор** (`boss_choir`).

3. **Level 4 «Чрево» — impossible geometry.**
   Задействовать `geometryOverrides`/портал-систему для зацикленных
   коридоров и ложных выходов, враг `flesh_machine` и `doppelganger`, босс
   **Сердце Отделения** (`boss_heart_hospital`).

4. **Level 5 «Город внутри» — открытые локации.**
   Новый набор материалов советского города (не больничных), stalker-like
   энкаунтеры, `hallucination_entity`/`white_observer`, первые
   predator-механики.

5. **Level 6 «Охота» — финал.**
   Полноценный predator gameplay, финальный босс **Пастырь**
   (`boss_shepherd`), разрушающаяся во время боя арена, довести до конца
   систему `ENDINGS`/`show_ending` для всех веток восприятия.

6. **Органическое оружие (третий ярус).**
   Чисто кодовая задача: расширить `WeaponId` в `src/game/systems/weapons.ts`
   до `bone_blade`/`organic_shotgun`/`parasitic_rifle`, завести их в
   inventory/HUD/подбор патронов. Спрайты и звук уже готовы — не хватает
   только wiring.

7. **Boss-энкаунтеры как отдельная система.**
   Сейчас боссы — это просто враги с большим HP: ни на одном уровне не
   заспавнены, уникальных arena-эффектов (гаснущий свет, ломающаяся
   геометрия, hallucinations во время боя из раздела 7 нарратива) в коде
   нет. Нужен общий слой boss-скриптинга поверх `triggers.ts`, который потом
   переиспользуется для всех пяти боссов по мере наполнения уровней.

8. **Полировка.**
   HUD-портреты per-level лежат как отдельные PNG
   (`sprites/hud/portrait_level_1_ward.png` … `portrait_level_6_hunt.png`).
   Разделение по уровням и perception-states — в
   `animations/ui/hud_portrait.json` (пока все states уровня указывают на
   один файл уровня; уникальные кадры per-state можно докинуть тем же
   форматом). Подключить манифест в `main.ts` вместо нарезки
   `portrait_sheet.png`. Арт `walk`/`attack`/`damaged`/`death` для
   `flesh_machine` на шите уже есть (нужен код). Решить судьбу
   `skyboxes/` / `shaders/` — либо подключить, либо убрать.

### Ассеты, которых не хватает

Списки ниже — то, что нужно догенерировать по отдельности. Пути и имена
файлов подобраны под существующую структуру `public/assets/**`, чтобы новые
файлы можно было просто положить рядом с уже имеющимися без правок кода
(там, где имя уже жёстко используется в `sfx-config.ts` / `manifest.ts`).

**Текстуры**

Файлы сгенерированы (лежат в `public/assets/…`). В код/манифест/карты
ещё не подключены — кроме городского набора, который уже был заведён ранее.

- Органика level3–4:
  - `textures/flesh/flesh_wall.png` (был)
  - `textures/flesh/flesh_closeup.png`
  - `textures/flesh/flesh_vent.png`
  - `textures/flesh/industrial_flesh.png`
  - `textures/ceilings/organic_ceiling.png`
- Полы/потолки по стадиям:
  - индустриальные: `floors/industrial_floor.png`,
    `ceilings/industrial_ceiling.png`
  - органические: `floors/organic_floor.png` (был),
    `ceilings/organic_ceiling.png`
  - городские: `floors/asphalt_floor.png`,
    `ceilings/urban_ceiling.png`
  - generic: `seamless_floor`, `seamless_ceiling` (были)
- Городской набор level5–6 (стены/двери + wiring):
  - стены: `panel_facade`, `school_plaster`, `entrance_hallway`,
    `bus_stop_concrete`
  - двери/ограждения: `apartment_door`, `metal_grate`, `rusty_gate`
- Декали: `decal_bloody`, `decal_wall` (были) + `decal_flesh_drip`,
  `decal_blood_fresh`, `decal_cracks`, `decal_rust`. В коде по-прежнему
  не подключены.

**Звуки (SFX)**

Собственные наборы врагов и боссов записаны и подключены
(`sfx-config.ts` + `enemy-profiles.ts`):

- `sounds/enemies/deformed_patient/` — idle/attack/hurt/death
- `sounds/enemies/flesh_watcher/` — idle/attack/hurt/death
- `sounds/enemies/flesh_eye/` — idle/attack/hurt/death
- `sounds/enemies/flesh_machine/` — idle/attack/hurt/death
- `sounds/enemies/doppelganger/` — idle/attack/hurt/death
- `sounds/bosses/choir/` — intro/attack/hurt/death
- `sounds/bosses/dade_keeper/` — intro/attack/hurt/death
- `sounds/bosses/shepherd/` — intro/attack/hurt/death

Оружие третьего яруса (`bone_blade`, `organic_shotgun`, `parasitic_rifle`) —
звук уже полностью готов в `sounds/weapons/`, тут ничего дозаписывать не
нужно.

**Музыка**

Файлы сгенерированы (в код пока не подключены):

- Alt для level5–6 (predator-восприятие):
  - `music/level_5/level_5_predator.mp3`
  - `music/level_6/level_6_predator.mp3`
- Боевые темы боссов (`music/bosses/`):
  - `boss_chief_doctor.mp3`
  - `boss_choir.mp3`
  - `boss_dade_keeper.mp3`
  - `boss_heart_hospital.mp3`
  - `boss_shepherd.mp3`

Ещё открыто по музыке (не генерация, а решение):
- `music/level_1/level_1_palata.mp3` используется, а
  `music/level_2/level_2_lower_block.mp3`,
  `music/level_3/level_3_complex_guts.mp3`,
  `music/level_4/level_4_complex_womb.mp3` лежат неиспользуемыми — уровни
  2–4 сейчас играют `..._legacy` версии. Нужно выбрать финальные треки
  и почистить лишние перед релизом.
