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

| Элемент                                                | Код                                           | Статус                                                      |
| ------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------- |
| Player base (HP, движение)                             | `src/types/game.d.ts`, `src/engine/engine.ts` | done                                                        |
| Inventory (медикаменты, инъекторы)                     | —                                             | todo                                                        |
| Трансформация (medicated/withdrawal/infected/predator) | `src/game/systems/world-state.ts`             | partial (states + medication mutex done; pickups/HUD — нет) |
| HUD-лицо как индикатор состояния                       | `index.html` (`#hudPortrait`)                 | todo (canvas есть, логика — нет)                            |

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
| `enemy` (generic)                         | `sprites/enemies/enemy.png`            | `src/game/systems/enemies.ts`        | done                                                         |
| `zombie`                                  | `sprites/enemies/zombie.png`           | `enemies.ts`                         | done                                                         |
| `skeleton_husk`                           | `sprites/enemies/skeleton_husk.png`    | —                                    | todo                                                         |
| `medical_orderly`                         | `sprites/enemies/medical_orderly.png`  | —                                    | todo                                                         |
| `deformed_patient`                        | `sprites/enemies/deformed_patient.png` | —                                    | todo                                                         |
| `flesh_watcher` (perception)              | `sprites/enemies/flesh_watcher.png`    | —                                    | todo                                                         |
| `doppelganger` (predator-trigger)         | `sprites/enemies/doppelganger.png`     | —                                    | todo                                                         |
| `hallucination_entity` / `white_observer` | `sprites/hallucinations/*.png`         | `src/game/systems/hallucinations.ts` | partial (perception-gated спрайты + burst SFX; нет AI, anim) |

## 7. Боссы

| Босс                     | Спрайт                    | Звук                 | Код | Статус |
| ------------------------ | ------------------------- | -------------------- | --- | ------ |
| Главврач                 | `boss_cheif_doctor.png`   | `chief_doctor_*.wav` | —   | todo   |
| Привратник (Dade Keeper) | `boss_dade_keepeer.png`   | —                    | —   | todo   |
| Хор                      | `boss_choir.png`          | —                    | —   | todo   |
| Сердце Отделения         | `boss_heart_hospital.png` | `heart_*.wav`        | —   | todo   |
| Пастырь (финал)          | `boss_shepherd.png`       | `predator_*.wav`     | —   | todo   |

## 8. Игровые механики

| Элемент                          | Код                                                                  | Статус                                              |
| -------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| Базовый movement / collision     | `engine.ts`                                                          | done                                                |
| Двери / ключи / замки            | `src/game/systems/doors.ts`                                          | done                                                |
| Pickups (health, keys)           | `src/game/systems/pickups.ts`                                        | done                                                |
| Triggers (enter_zone + actions)  | `src/game/systems/triggers.ts`                                       | done                                                |
| Medication mechanic              | —                                                                    | todo                                                |
| Infection / perception switching | `world-state.ts` (`setMedication`), `triggers.ts` (`set_medication`) | partial (триггеры + API готовы, item-pickups — нет) |
| Predator abilities               | —                                                                    | todo                                                |

## 9. Оружие

| Тир                  | Оружие                                       | Спрайт                                          | Код | Статус                                         |
| -------------------- | -------------------------------------------- | ----------------------------------------------- | --- | ---------------------------------------------- |
| 1. Импровизированное | pipe, skalpel                                | `sprites/weapons/pipe.png`, `skalpel.png`       | —   | todo                                           |
| 2. Индустриальное    | pistol, revolver, shotgun                    | `sprites/weapons/{pistol,revolver,shotgun}.png` | —   | todo (есть только `Space → onShoot` из engine) |
| 3. Органическое      | bone_blade, organic_shotgun, parasitic_rifle | `sprites/weapons/*`                             | —   | todo                                           |

HUD: `#hudWeaponValue` / `#hudAmmoValue` присутствуют в `index.html`, не подключены.

## 10. Предметы

| Элемент                   | Ассеты                                                           | Код               | Статус |
| ------------------------- | ---------------------------------------------------------------- | ----------------- | ------ |
| Silver / Gold / Blood key | `sprites/pickups/keys/*.png`                                     | `pickups.ts`, HUD | done   |
| Health (medkit)           | `sprites/pickups/health/*.png`                                   | `pickups.ts`      | done   |
| Haloperidol               | `sprites/pickups/medication/haloperidol.png`                     | —                 | todo   |
| Experimental injector     | `sprites/pickups/medication/injector.png`                        | —                 | todo   |
| Documents / artifacts     | `sprites/pickups/documents`, `sprites/pickups/artifacts` (пусто) | —                 | todo   |

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

| Элемент                | Код                        | Статус                                                |
| ---------------------- | -------------------------- | ----------------------------------------------------- |
| DDA raycaster          | `src/raycast/raycaster.ts` | done                                                  |
| Layered map format     | `level-loader.ts`          | done                                                  |
| Entity architecture    | `rayc.ts` `setEntities`    | done (perception-gated, sticky entity-driven enemies) |
| Trigger / event system | `triggers.ts`              | done                                                  |
| World state system     | `world-state.ts`           | done                                                  |
| Lighting system        | `lights.ts`                | partial                                               |
| Modular asset pipeline | `public/assets/**`         | partial (структура есть, sound categories пустые)     |
| HUD framework          | `index.html` + `rayc.ts`   | partial (нет face/distortion/predator overlays)       |

## 15. Музыка и звук

| Элемент                                                  | Код                               | Статус                            |
| -------------------------------------------------------- | --------------------------------- | --------------------------------- |
| AudioManager (music + sfx)                               | `src/game/audio/audio-manager.ts` | done                              |
| SFX registry                                             | `src/game/audio/sfx-config.ts`    | done (namespaced `SFX.*` catalog) |
| Per-level music                                          | `level*.json` `audio.music`       | done                              |
| Ambient bed (бесшовный layer per state)                  | —                                 | todo                              |
| Hallucination audio (whisper, vhs_glitch, insanity_ring) | `hallucinations.ts` (burst, ring) | partial (whisper loop — нет)      |
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
