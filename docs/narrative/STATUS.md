# Narrative → Code Status

Карта соответствия нарративного документа (`docs/narrative/narrative.txt`)
текущей реализации в коде.

Статусы:

- **done** — реализовано и используется на уровнях.
- **partial** — каркас есть, но не покрывает требований документа.
- **todo** — отсутствует, требуется реализация.

## 1. Концепция / общий тон

| Элемент                            | Код                                                | Статус                  |
| ---------------------------------- | -------------------------------------------------- | ----------------------- |
| Raycasting + Canvas 2D             | `src/raycast/raycaster.ts`, `src/engine/engine.ts` | done                    |
| Атмосфера nightmare/horror         | VHS overlay, ambience, perception HUD filter       | partial (визуал/звук есть; не хватает organic light + animations) |
| Жанровый дрейф survival → predator | `predator.ts` + `world-state.ts`                   | partial (механики есть; уровень `level6` под охоту — todo)        |

## 2. Сюжет / 5. Главный герой

| Элемент                                                | Код                                           | Статус                                                        |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------- |
| Player base (HP, движение)                             | `src/types/game.d.ts`, `src/engine/engine.ts` | done                                                          |
| Inventory (медикаменты, инъекторы)                     | `src/game/systems/inventory.ts` + `items.ts`  | partial (haloperidol/injector/ammo/docs counters; injector эффект — done) |
| Трансформация (medicated/withdrawal/infected/predator) | `src/game/systems/world-state.ts`             | partial (states + medication mutex done; HUD overlay done; injector эффект — done)   |
| HUD-лицо как индикатор состояния                       | `#hudPortrait` + `_perception.styl`           | partial (portrait по HP + per-perception CSS-filter; нет уникальных кадров лица per state) |

## 3. Повествование без катсцен

| Элемент                       | Код                                  | Статус                                       |
| ----------------------------- | ------------------------------------ | -------------------------------------------- |
| Note overlay                  | `src/game/ui/note-overlay.ts`        | done                                         |
| Environmental triggers        | `src/game/systems/triggers.ts`       | done                                         |
| Документы / надписи на стенах | спрайты `sprites/pickups/documents/` | partial (entity типа `note` есть; счётчик документов есть; контент — позже) |

## 4. Игровой мир / 11. Атмосфера

| Элемент                                | Код                               | Статус                                                       |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Layered map (geometry + materialsWall) | `src/game/levels/level-loader.ts` | done                                                         |
| World states / flags                   | `src/game/systems/world-state.ts` | done                                                         |
| Floor/ceiling casting                  | `src/game/render/renderer.ts`     | partial (плоский цвет / pattern fill + horizon distance shading; нет текстурирования per-pixel) |
| VHS / chromatic aberration / scanlines | `assets/overlays/overlay_vhs.png`, `style.css` `.vhs-overlay` | done (perception-driven intensity)                |
| Динамический свет                      | `src/game/systems/lights.ts`      | done (modes: steady / flicker / emergency / pulse / organic + perception-gated) |

## 6. Враги

| Враг                                      | Спрайт                                 | Код                                  | Статус                                                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `skeleton_husk`                           | `sprites/enemies/skeleton_husk.png`    | `enemy-profiles.ts` + `enemies.ts`   | done (sprite + SFX profile + damage bracket)                 |
| `medical_orderly`                         | `sprites/enemies/medical_orderly.png`  | `enemy-profiles.ts` + `enemies.ts`   | done                                                          |
| `deformed_patient`                        | `sprites/enemies/deformed_patient.png` | `enemy-profiles.ts` + `enemies.ts`   | done (HP/speed tuned, no unique anims yet)                    |
| `flesh_watcher` (perception)              | `sprites/enemies/flesh_watcher.png`    | `enemy-profiles.ts` + `enemies.ts`   | done (perception-gated via `enabledInStates`)                 |
| `flesh_eye` (wall-pulse)                  | `sprites/enemies/flesh_eye.png`        | `enemy-profiles.ts` + `enemies.ts` + `animations/enemies/flesh_eye.json`   | done (3-frame sheet нарезан, 4 fps loop)                  |
| `flesh_machine` (heavy hybrid)            | `sprites/enemies/flesh_machine.png`    | `enemy-profiles.ts` + `enemies.ts` + `animations/enemies/flesh_machine.json` | partial (idle row нарезан, 5 fps; walk/ranged/damaged/death rows и per-state переключение — todo) |
| `doppelganger` (predator-trigger)         | `sprites/enemies/doppelganger.png`     | `enemy-profiles.ts` + `enemies.ts`   | done                                                          |
| `hallucination_entity` / `white_observer` | `sprites/enemies/{hallucination_entity,white_observer}.png` | `src/game/systems/hallucinations.ts` | partial (perception-gated спрайты + burst SFX; нет AI, anim) |

## 7. Боссы

| Босс                     | Спрайт                    | Звук                 | Код | Статус |
| ------------------------ | ------------------------- | -------------------- | --- | ------ |
| Главврач                 | `boss_cheif_doctor.png`   | `chief_doctor_*.wav` | `enemy-profiles.ts` `BOSS_CHIEF_DOCTOR`  | partial (статы/звук/scale=1.5; без фаз и unique механик)   |
| Привратник (Dade Keeper) | `boss_dade_keepeer.png`   | фоллбэк orderly  | `enemy-profiles.ts` `BOSS_DADE_KEEPER`   | partial (статы; нужен уникальный SFX)   |
| Хор                      | `boss_choir.png`          | фоллбэк hallucinations | `enemy-profiles.ts` `BOSS_CHOIR`    | partial (статы/whisper-SFX; scale=1.6)        |
| Сердце Отделения         | `boss_heart_hospital.png` | `heart_*.wav`        | `enemy-profiles.ts` `BOSS_HEART_HOSPITAL` | partial (стационарный, HP=32, scale=2.2)  |
| Пастырь (финал)          | `boss_shepherd.png`       | `predator_*.wav`     | `enemy-profiles.ts` `BOSS_SHEPHERD`      | partial (быстрый chase 1.3; нужен финальный act) |

## 8. Игровые механики

| Элемент                          | Код                                                                  | Статус                                                   |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | --- |
| Базовый movement / collision     | `engine.ts`                                                          | done                                                     |
| Двери / ключи / замки            | `src/game/systems/doors.ts`                                          | done                                                     |
| Pickups (health, keys)           | `src/game/systems/pickups.ts`                                        | done                                                     |
| Triggers (enter_zone + actions)  | `src/game/systems/triggers.ts`                                       | done                                         |
| Medication mechanic              | `items.ts`, `setMedication`                                          | done                                                     |     |
| Infection / perception switching | `world-state.ts` (`setMedication`), `triggers.ts` (`set_medication`) | done                                                     |
| Predator abilities               | `src/game/systems/predator.ts`                                       | partial (speed/sprint/damage mul + slow HP regen)        |
| Weapons (pipe / pistol / shotgun) | `src/game/systems/weapons.ts`                                       | done (per-weapon SFX, ammo from inventory, 1/2/3 + Q switch) |

## 9. Оружие

| Тир                  | Оружие                                       | Спрайт                                          | Код | Статус                                         |
| -------------------- | -------------------------------------------- | ----------------------------------------------- | --- | ---------------------------------------------- |
| 1. Импровизированное | pipe, skalpel                                | `sprites/weapons/pipe.png`, `skalpel.png`       | `weapons.ts` | partial (pipe wired; skalpel — нет)                |
| 2. Индустриальное    | pistol, revolver, shotgun                    | `sprites/weapons/{pistol,revolver,shotgun}.png` | `weapons.ts` | partial (pistol/shotgun wired; revolver — нет)     |
| 3. Органическое      | bone_blade, organic_shotgun, parasitic_rifle | `sprites/weapons/*`                             | —   | todo                                           |

HUD: `#hudWeaponValue` / `#hudAmmoValue` показывают текущее оружие и счётчик патронов из инвентаря.

## 10. Предметы

| Элемент                   | Ассеты                                                           | Код               | Статус                                  |
| ------------------------- | ---------------------------------------------------------------- | ----------------- | --------------------------------------- |
| Silver / Gold / Blood key | `sprites/pickups/keys/*.png`                                     | `pickups.ts`, HUD | done                                    |
| Health (medkit)           | `sprites/pickups/health/*.png`                                   | `pickups.ts`      | done                                                     |
| Haloperidol               | `sprites/pickups/medication/haloperidol.png`                     | `items.ts`        | done                                    |
| Experimental injector     | `sprites/pickups/medication/injector.png`                        | `items.ts`        | done |
| Documents / artifacts     | `sprites/pickups/documents`, `sprites/pickups/artifacts` (пусто) | `inventory.ts`, HUD `#hudDocsValue` | partial (счётчик в HUD; entity-pickup есть; арт/контент — позже)                    |

## 12. Уровни

| Уровень         | Файл          | Соответствие нарративу                      | Статус  |
| --------------- | ------------- | ------------------------------------------- | ------- |
| Палата          | `level1.json` | 56×42 ward, 5 этажей × 2 крыла: archive(gold-lock)/post, procedure/shower, ward A/day-room, ward B/storage, spawn-холл; husk×4 + orderly×2 ambush; hallucinations в shower/ward A; silence-burst в душевой; show_ending(clean) на выходе | done |
| Нижний блок     | `level2.json` | то же                                       | partial |
| Кишки комплекса | `level3.json` | flesh-текстуры не задействованы             | partial |
| Чрево           | `level4.json` | impossible geometry не реализована          | partial (portal-система есть; нужно наполнить уровень) |
| Город внутри    | `level5.json` | open layout не задействован                 | partial |
| Охота           | `level6.json` | predator gameplay отсутствует               | partial |

## 13. Художественный стиль

| Элемент                               | Код                                | Статус                          |
| ------------------------------------- | ---------------------------------- | ------------------------------- |
| Low-res / no smoothing                | `src/canvas-init.ts`               | done                            |
| Палитра / shading                     | `renderer.ts`                      | partial (только верт. градиент) |
| Sprite animations (idle/attack/death) | `assets/animations/**/*.json` + `src/game/render/animations.ts` | partial (рантайм + sheet-slicing работает на `flesh_eye`/`flesh_machine`; per-AI-state переключение idle→walk→attack — todo) |

## 14. Техническая архитектура

| Элемент                | Код                        | Статус                                                                     |
| ---------------------- | -------------------------- | -------------------------------------------------------------------------- |
| DDA raycaster          | `src/raycast/raycaster.ts` | done                                                                       |
| Layered map format     | `level-loader.ts`          | done (+ `geometryOverrides` для hidden-geometry per perception)                  |
| Entity architecture    | `rayc.ts` `setEntities`    | done (perception-gated, sticky entity-driven enemies)                      |
| Trigger / event system | `triggers.ts`              | done                                                                       |
| World state system     | `world-state.ts`           | done                                                                       |
| Lighting system        | `lights.ts`                | done (5 modes, color/intensity, perception/flag gating)                    |
| Modular asset pipeline | `public/assets/**`         | partial (структура есть, sound categories пустые)                          |
| HUD framework          | `app.pug` + `_hud.styl` + `_perception.styl` | partial (MEDS/DOCS/AMMO/WEAPON + perception overlay + per-state filter/glitch; portrait sprites per-state — позже) |

## 15. Музыка и звук

| Элемент                                                  | Код                               | Статус                            |
| -------------------------------------------------------- | --------------------------------- | --------------------------------- |
| AudioManager (music + sfx)                               | `src/game/audio/audio-manager.ts` | done                              |
| SFX registry                                             | `src/game/audio/sfx-config.ts`    | done (namespaced `SFX.*` catalog) |
| Per-level music                                          | `level*.json` `audio.music`       | done                              |
| Ambient bed (бесшовный layer per state)                  | `src/game/systems/ambience.ts`    | done (breath + bed per perception, machinery emitters) |
| Hallucination audio (whisper, vhs_glitch, insanity_ring) | `hallucinations.ts` (burst, ring) + `ambience.ts` (whisper loop) | done                              |
| Тишина как событие                                       | `audio-manager.ts` `silenceFor` + trigger action `silence_burst` | done                              |

## 16. Финальная художественная цель

| Элемент                 | Код                       | Статус                           |
| ----------------------- | ------------------------- | -------------------------------- |
| Неоднозначный финал     | `ENDINGS` + `show_ending` trigger action | partial (6 вариантов по perception state; нужен финальный уровень) |
| Death screen            | `deathRoot` + `pickEpitaph` в `main.ts`  | done (perception-aware эпитафии, restart → menu) |
| Credits / ending screen | `endingRoot` + `_menus.styl` `.menu--ending`  | done (UI готов, ending texts wired) |

---

Этот файл — живой. Каждый последующий коммит из нарративного roadmap должен
обновлять соответствующие строки (`todo → partial → done`).
