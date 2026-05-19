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
| Атмосфера nightmare/horror         | —                                                  | todo (см. фазу 5)       |
| Жанровый дрейф survival → predator | —                                                  | todo (см. фазы 2, 4, 6) |

## 2. Сюжет / 5. Главный герой

| Элемент                                                | Код                                           | Статус                                                        |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------- |
| Player base (HP, движение)                             | `src/types/game.d.ts`, `src/engine/engine.ts` | done                                                          |
| Inventory (медикаменты, инъекторы)                     | `src/game/systems/inventory.ts` + `items.ts`  | partial (haloperidol/injector/ammo/docs counters; injector эффект — позже) |
| Трансформация (medicated/withdrawal/infected/predator) | `src/game/systems/world-state.ts`             | partial (states + medication mutex done; HUD overlay done; injector эффект — нет)   |
| HUD-лицо как индикатор состояния                       | `index.html` (`#hudPortrait`)                 | partial (portrait по HP есть; perception overlay поверх canvas есть)            |

## 3. Повествование без катсцен

| Элемент                       | Код                                  | Статус                                       |
| ----------------------------- | ------------------------------------ | -------------------------------------------- |
| Note overlay                  | `src/game/ui/note-overlay.ts`        | done                                         |
| Environmental triggers        | `src/game/systems/triggers.ts`       | done                                         |
| Документы / надписи на стенах | спрайты `sprites/pickups/documents/` | todo (entity типа `note` есть, контента нет) |

## 4. Игровой мир / 11. Атмосфера

| Элемент                                | Код                               | Статус                                                       |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| Layered map (geometry + materialsWall) | `src/game/levels/level-loader.ts` | done                                                         |
| World states / flags                   | `src/game/systems/world-state.ts` | done                                                         |
| Floor/ceiling casting                  | `src/game/render/renderer.ts`     | partial (плоский цвет / pattern fill, без distance shading)  |
| VHS / chromatic aberration / scanlines | `assets/overlays/overlay_vhs.png` | todo                                                         |
| Динамический свет                      | `src/game/systems/lights.ts`      | partial (radius + flicker bool, нет emergency/pulse/organic) |

## 6. Враги

| Враг                                      | Спрайт                                 | Код                                  | Статус                                                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `skeleton_husk`                           | `sprites/enemies/skeleton_husk.png`    | `enemy-profiles.ts` + `enemies.ts`   | done (sprite + SFX profile + damage bracket)                 |
| `medical_orderly`                         | `sprites/enemies/medical_orderly.png`  | `enemy-profiles.ts` + `enemies.ts`   | done                                                          |
| `deformed_patient`                        | `sprites/enemies/deformed_patient.png` | `enemy-profiles.ts` + `enemies.ts`   | done (HP/speed tuned, no unique anims yet)                    |
| `flesh_watcher` (perception)              | `sprites/enemies/flesh_watcher.png`    | `enemy-profiles.ts` + `enemies.ts`   | done (perception-gated via `enabledInStates`)                 |
| `flesh_eye` (wall-pulse)                  | `sprites/enemies/flesh_eye.png`        | `enemy-profiles.ts` + `enemies.ts`   | partial (профиль есть, sheet 3 кадра — анимация не нарезана) |
| `flesh_machine` (heavy hybrid)            | `sprites/enemies/flesh_machine.png`    | `enemy-profiles.ts` + `enemies.ts`   | partial (профиль есть, 5-rows animation sheet не нарезан)    |
| `doppelganger` (predator-trigger)         | `sprites/enemies/doppelganger.png`     | `enemy-profiles.ts` + `enemies.ts`   | done                                                          |
| `hallucination_entity` / `white_observer` | `sprites/enemies/{hallucination_entity,white_observer}.png` | `src/game/systems/hallucinations.ts` | partial (perception-gated спрайты + burst SFX; нет AI, anim) |

## 7. Боссы

| Босс                     | Спрайт                    | Звук                 | Код | Статус |
| ------------------------ | ------------------------- | -------------------- | --- | ------ |
| Главврач                 | `boss_cheif_doctor.png`   | `chief_doctor_*.wav` | —   | todo   |
| Привратник (Dade Keeper) | `boss_dade_keepeer.png`   | —                    | —   | todo   |
| Хор                      | `boss_choir.png`          | —                    | —   | todo   |
| Сердце Отделения         | `boss_heart_hospital.png` | `heart_*.wav`        | —   | todo   |
| Пастырь (финал)          | `boss_shepherd.png`       | `predator_*.wav`     | —   | todo   |

## 8. Игровые механики

| Элемент                          | Код                                                                  | Статус                                                   |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | --- |
| Базовый movement / collision     | `engine.ts`                                                          | done                                                     |
| Двери / ключи / замки            | `src/game/systems/doors.ts`                                          | done                                                     |
| Pickups (health, keys)           | `src/game/systems/pickups.ts`                                        | done                                                     |
| Triggers (enter_zone + actions)  | `src/game/systems/triggers.ts`                                       | done                                                     |
| Medication mechanic              | `items.ts`, `setMedication`                                          | partial (haloperidol → medicated; injector только склад) |     |
| Infection / perception switching | `world-state.ts` (`setMedication`), `triggers.ts` (`set_medication`) | partial (триггеры + API готовы, item-pickups — нет)      |
| Predator abilities               | —                                                                    | todo                                                     |
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
| Health (medkit)           | `sprites/pickups/health/*.png`                                   | `pickups.ts`      | done                                    |
| Haloperidol               | `sprites/pickups/medication/haloperidol.png`                     | `items.ts`        | done                                    |
| Experimental injector     | `sprites/pickups/medication/injector.png`                        | `items.ts`        | partial (подбор + счётчик, нет эффекта) |
| Documents / artifacts     | `sprites/pickups/documents`, `sprites/pickups/artifacts` (пусто) | `inventory.ts`, HUD `#hudDocsValue` | partial (счётчик в HUD; entity-pickup ещё нет)                    |

## 12. Уровни

| Уровень         | Файл          | Соответствие нарративу                      | Статус  |
| --------------- | ------------- | ------------------------------------------- | ------- |
| Палата          | `level1.json` | базовая геометрия есть, ассеты не подобраны | partial |
| Нижний блок     | `level2.json` | то же                                       | partial |
| Кишки комплекса | `level3.json` | flesh-текстуры не задействованы             | partial |
| Чрево           | `level4.json` | impossible geometry не реализована          | partial |
| Город внутри    | `level5.json` | open layout не задействован                 | partial |
| Охота           | `level6.json` | predator gameplay отсутствует               | partial |

## 13. Художественный стиль

| Элемент                               | Код                                | Статус                          |
| ------------------------------------- | ---------------------------------- | ------------------------------- |
| Low-res / no smoothing                | `src/canvas-init.ts`               | done                            |
| Палитра / shading                     | `renderer.ts`                      | partial (только верт. градиент) |
| Sprite animations (idle/attack/death) | `assets/animations/enemies/*.json` | todo (json есть, runtime нет)   |

## 14. Техническая архитектура

| Элемент                | Код                        | Статус                                                                     |
| ---------------------- | -------------------------- | -------------------------------------------------------------------------- |
| DDA raycaster          | `src/raycast/raycaster.ts` | done                                                                       |
| Layered map format     | `level-loader.ts`          | done                                                                       |
| Entity architecture    | `rayc.ts` `setEntities`    | done (perception-gated, sticky entity-driven enemies)                      |
| Trigger / event system | `triggers.ts`              | done                                                                       |
| World state system     | `world-state.ts`           | done                                                                       |
| Lighting system        | `lights.ts`                | partial                                                                    |
| Modular asset pipeline | `public/assets/**`         | partial (структура есть, sound categories пустые)                          |
| HUD framework          | `index.html` + `rayc.ts`   | partial (MEDS/DOCS/AMMO/WEAPON + perception overlay; portrait per-state — позже) |

## 15. Музыка и звук

| Элемент                                                  | Код                               | Статус                            |
| -------------------------------------------------------- | --------------------------------- | --------------------------------- |
| AudioManager (music + sfx)                               | `src/game/audio/audio-manager.ts` | done                              |
| SFX registry                                             | `src/game/audio/sfx-config.ts`    | done (namespaced `SFX.*` catalog) |
| Per-level music                                          | `level*.json` `audio.music`       | done                              |
| Ambient bed (бесшовный layer per state)                  | `src/game/systems/ambience.ts`    | done (breath + bed per perception, machinery emitters) |
| Hallucination audio (whisper, vhs_glitch, insanity_ring) | `hallucinations.ts` (burst, ring) + `ambience.ts` (whisper loop) | done                              |
| Тишина как событие                                       | —                                 | todo                              |

## 16. Финальная художественная цель

| Элемент                 | Код                       | Статус                           |
| ----------------------- | ------------------------- | -------------------------------- |
| Неоднозначный финал     | —                         | todo                             |
| Death screen            | `index.html` `#deathRoot` | partial (есть UI, нет нарратива) |
| Credits / ending screen | —                         | todo                             |

---

Этот файл — живой. Каждый последующий коммит из нарративного roadmap должен
обновлять соответствующие строки (`todo → partial → done`).
