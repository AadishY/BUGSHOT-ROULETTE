> ### ⚠️ **Important Notice & Inspiration**
> This game is **heavily inspired by Buckshot Roulette**. No model, textures or script have been used or extracted from the original game files; all visual assets are completely self-made.
> 
> Some item sounds and background music used in this project were found publicly online—they were **not** obtained via reverse engineering. These sounds will be promptly removed if requested by the original creators.

---

<div align="center">

# 🎯 AADISH ROULETTE

<img src="public/image/Banner.jpg" alt="Aadish Roulette Banner" width="100%" style="border-radius: 12px;" />

### A Deadly Game of Chance

[![Play Now](https://img.shields.io/badge/PLAY%20NOW-Live%20Demo-orange?style=for-the-badge&logo=cloudflare)](https://aadishroulette.pages.dev/)
[![GitHub](https://img.shields.io/badge/GitHub-AadishY-black?style=for-the-badge&logo=github)](https://github.com/AadishY)

---

<img src="public/image/Banner%20gif.gif" alt="Aadish Roulette Gameplay Banner" width="100%" style="border-radius: 12px;" />

*A high-stakes tabletop horror game where you play Russian Roulette with a 12-gauge pump-action shotgun.*

</div>

---

## 🎬 About

**Aadish Roulette** is a web-based reimagining of the deadly shotgun game, inspired by Mike Klubnika's *Buckshot Roulette*. Built with React, TypeScript, and Three.js, it features 3D layouts, retro CRT filters, atmospheric volumetric lighting, and strategic item play.

---

## Gameplay Showcase

https://github.com/user-attachments/assets/e369969c-1fcc-43d0-994e-a4c02572d001


---

## 🎮 How to Play

1. **Enter Your Identity**: Input your codename and click "Bind Soul" on the startup terminal.
2. **Mag Capacity**: A magazine of 2 to 8 random shells is loaded. You are shown how many are **LIVE** (red) and how many are **BLANK** (blue).
3. **Choosing Targets**: Shoot the dealer (1 damage if Live, turn ends) or yourself (if Blank, you retain your turn!).
4. **Use Items**: Strategically consume items before grabbing the gun to turn the odds in your favor.
5. **Win or Die**: Knock the opponent's health to 0 to advance or win.

---

## 🔧 Item Guide & Descriptions

| Icon | Item Name | Gameplay Description & Tactical Strategy |
| :---: | :--- | :--- |
| 🚬 | **Cigarettes** | Restores 1 HP (capped at max). Always use when injured. |
| 🍺 | **Beer** | Ejects the current shell without firing it. Shows the ejected shell type. Does NOT consume Choke Mod status. |
| 🔗 | **Handcuffs** | Skips the opponent's next turn. Cannot stack if already cuffed. |
| 🔍 | **Magnifying Glass** | Inspects the current shell, revealing LIVE or BLANK. Dealer uses it silently. |
| ✂️ | **Hand Saw** | Saws off the barrel — doubles next shot damage to 2 HP. Stacks with Choke Mod. |
| 📞 | **Burner Phone** | Reveals a random future shell (3rd+). Hidden: 5% chance the caller LIES about the type. |
| 🔄 | **Inverter** | Inverts current shell polarity (Live↔Blank). Does not reveal the result. |
| 💉 | **Adrenaline** | Steals an item from the opponent and uses it instantly. Cannot steal Totem or another Adrenaline. |
| 📡 | **Remote** | Swaps the current shell position with the next shell. Fails if only 1 shell remains. |
| ⚡ | **Big Inverter** | Inverts polarity of ALL remaining shells in the magazine. |
| 🥋 | **Choke** | Fires current + next shell simultaneously. Both LIVE = 2 DMG, one = 1 DMG, both blank = 0. Saw doubles total. |
| 🩸 | **Blood Contract** | Sacrifice 1 HP for 2 high-tier items (weighted pool). Lucky Charm boosts high-tier weight to 15x+. Using at 1 HP = instant death. Player-only. Max 1 per inventory. |
| 🍀 | **Lucky Charm** | Boosts next shipment quality. Stacks multiplicatively. Also massively boosts Blood Contract loot. Consumed after use. Max 1 per inventory. |
| 💥 | **Flashbang** | Blinds opponent — prevents ALL item usage on their next turn. They can still shoot. |
| 🔨 | **Crusher** | Destroys 1 random item from opponent's inventory. Can destroy Totem. Fails if empty. |
| 🌟 | **Totem of Undying** | [PASSIVE] Auto-saves at 1 HP on lethal damage. Cannot be stolen via Adrenaline. Can be destroyed by Crusher. Max 1. |
| 🪞 | **Mirror** | Replays ALL items opponent used on their last turn, in sequence. Excludes Mirror itself. |
| 🃏 | **Tarot Deck** | Draw one of 6 randomly fanned cards. 11 possible cards with varied effects. |
| 🎰 | **Jackpot Machine** | Spin to win immunity! 20% 3-shot immune (7-7-7 Jackpot Win), 30% 1-shot immune (Cherry-Cherry-Lemon Normal Win), 50% lose. Only live shots decrement immunity; blank self/dealer shots are exempt. Using Blood Contract consumes 1 immunity shot instead of 1 HP. Stacks. |

---

## 🃏 Tarot Card Deck

When using the **Tarot Deck** item, 6 cards are fanned face-down on the table. You select one to flip and reveal its power. The deck features 11 possible cards:

| Card Face | Type / Color | Effect Description |
| :--- | :---: | :--- |
| **The Magician** | Active (Purple) | Gain 1 random item (discarded if inventory full). |
| **The Hanged Man** | Penalty (Red) | Lose 1 HP. Totem auto-triggers if this is lethal. |
| **The Hermit** | Penalty (Grey) | Instantly transfers your turn to your opponent. You do NOT shoot. |
| **The Moon** | Active (Blue) | Steal 1 random item from opponent (excluding Totem). Discarded if full. |
| **Judgment** | Active (Yellow) | If current shell is BLANK, 50% chance to secretly convert to LIVE. No effect on LIVE. Neither player told. |
| **Wheel of Fortune** | Active (Orange) | Reshuffles all remaining shells. Invalidates Glass/Phone intel. |
| **The Sun** | Active (Yellow) | Heal 1 HP (capped at max). |
| **Death** | Penalty (Zinc) | Destroy 1 random item from YOUR OWN inventory. Can destroy Totem. |
| **The Tower** | Active (Amber) | Destroy 1 random item from opponent's inventory (excluding Totem). |
| **The Fool** | Active (Pink) | Reveals a shell type. Lie probability: 0% (3+ shells), 10% (2 shells), 25% (1 shell). |
| **Justice** | Active (Emerald) | Swap your HP with opponent's HP. Extremely powerful when you're low and they're high. |
| **Temperance** | Active (Sky Blue) | Swap all items with opponent. Great if they have more or better items. |

---

## ⚙️ Game Modes

### Normal Mode
- **Starting HP**: 4 HP for both player and dealer.
- **Item Shipments**:
  - Rounds 1-3: 2 items per shipment.
  - Rounds 4-9: 3 items per shipment.
  - Rounds 10+: 4 items per shipment.
- **Cheating**: Dealer uses standard item probabilities and logical AI options.

### Hard Mode (High-Stakes Protocols)
- **Starting HP Progression**:
  - Stage 1: 2 HP.
  - Stage 2: 3 HP.
  - Stage 3: 4 HP.
- **Item Shipments**:
  - Stage 1-2: 2 items per shipment.
  - Stage 3: 1 to 4 random items per shipment.
  - Stage 4+: 4 items per shipment.
- **Duplicate Restriction**: Only unique items (Blood Contract, Lucky Charm, Totem) are limited to 1 per inventory. Standard items can appear multiple times.
- **Dealer Cheating Mode**: In Hard Mode, the Dealer draws items tailored to their combat state (Panic vs. Aggressive). Has 60% supernatural intuition to sense shells. 50% chance to pick best Tarot card.

---

## 📊 Item Drop Probabilities

### Player Item Pool
Contracts are tested first. If the contract roll succeeds, it is drawn; otherwise, standard items are drawn from the remaining pool.

| Item | Normal Mode | Hard Mode |
| :--- | :---: | :---: |
| **Blood Contract** | **9.0%** | **7.0%** |
| **Beer** | **10.0%** | **15.0%** |
| **Cigarettes** | **9.0%** | **4.0%** |
| **Magnifying Glass** | **7.0%** | **8.0%** |
| **Handcuffs** | **7.0%** | **8.0%** |
| **Burner Phone** | **8.0%** | **8.0%** |
| **Hand Saw** | **5.0%** | **5.0%** |
| **Inverter** | **7.0%** | **8.0%** |
| **Adrenaline** | **7.0%** | **7.0%** |
| **Choke** | **5.0%** | **5.0%** |
| **Big Inverter** | **4.0%** | **4.0%** |
| **Lucky Charm** | **4.0%** | **4.0%** |
| **Flashbang** | **5.0%** | **5.0%** |
| **Crusher** | **3.0%** | **3.0%** |
| **Mirror** | **4.0%** | **4.0%** |
| **Tarot Deck Card** | **3.0%** | **4.0%** |
| **Totem of Undying** | **1.0%** | **1.0%** |
| **Jackpot Slot Machine** | **2.0%** | **1.0%** |

*Note: Dealer cannot draw a Blood Contract. Unique items (Contract, Lucky Charm, Totem) max 1 per inventory.*

---

### Dealer Item Pool (Hard Mode Cheating)
In Hard Mode, the dealer draws items tailored dynamically to their current HP level:

#### 1. Survival Panic Mode (Dealer HP <= 2)
Dealer focuses purely on healing, turn-skipping, and emergency damage:
- 🚬 **Cigarettes (Heal)**: **30.0%**
- 🍺 **Beer (Eject shell)**: **15.0%**
- 🌟 **Totem of Undying (Passive)**: **15.0%**
- 💉 **Adrenaline (Steal item)**: **10.0%**
- 🔗 **Handcuffs (Skip player)**: **10.0%**
- ✂️ **Hand Saw (Damage)**: **10.0%**
- 🥋 **Choke (Damage)**: **10.0%**

#### 2. Aggressive Killer Mode (Dealer HP > 2)
Dealer focuses on maximizing damage output and board control:
- ✂️ **Hand Saw (Double damage)**: **25.0%**
- 🥋 **Choke (Double barrel volley)**: **25.0%**
- 🔍 **Magnifying Glass (Intel)**: **15.0%**
- 🔗 **Handcuffs (Skip player)**: **10.0%**
- 🔄 **Inverter (Polarity swap)**: **10.0%**
- 💉 **Adrenaline (Steal item)**: **2.0%**
- ⚡ **Big Inverter (Bulk swap)**: **5.0%**
- 🌟 **Totem of Undying (Passive)**: **8.0%**

---

## 🛠️ Installation & Development

This project uses [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [Three.js](https://threejs.org/).

### Quick Start

```bash
# Clone the repository
git clone [https://github.com/AadishY/Aadish-Roulette.git](https://github.com/AadishY/Aadish-Roulette.git)
cd Aadish-Roulette

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🚀 Tech Stack

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.181-black?style=flat-square&logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.0-06B6D4?style=flat-square&logo=tailwindcss)
![Socket.io](https://img.shields.io/badge/Socket.io-4.0-010101?style=flat-square&logo=socket.io)

</div>

---
 
## 📜 Changelog

### v2.1.2 (Slot Machine Model & Staggered Spins)
- **Upgraded Jackpot Slot Machine 3D Model**: Developed a larger, premium 3D cabinet housing featuring three separate horizontal cylinders, golden chrome panels, vertical divider trims, and high-definition vertical emoji canvas strips.
- **Realistic Staggered Spin Physics**: Programmed sequential wheel braking (Left reel at 1.8s, Center at 2.15s, Right at 2.5s) decelerating smoothly via a trigonometric ease-out curve.
- **Jackpot Probability Redesign**: Tuned spin outcome distributions to: 20% Jackpot Win (7-7-7 reel match), 30% Normal Win (Cherry-Cherry-Lemon match), and 50% No Win (Apple-Lemon-Bell match).

### v2.1.1 (Performance Safeguards & Jackpot Refinements)
- **Performance Detector**: Integrated real-time frame rate monitoring in the ThreeJS canvas loop. Automatically prompts players with a CRT warning pop-up if the frame rate dips below 30 FPS, giving quick controls to switch graphics profiles to Balanced or Potato.
- **Exempt Blank Shots**: Prevent blank shells (fired by either the Player or Dealer) from decrementing the player's Jackpot immunity. Only live shots and Blood Contract sacrifices decrement immunity.
- **Blood Contract Integration**: Using a Blood Contract with active Jackpot immunity consumes 1 immunity shot and triggers the RCT healing animation sequence instead of permanently losing 1 HP.
- **Persistent Jackpot Loop**: Ensured that the Jackpot win background loop persists across round transitions and shotgun reloads if the player still has remaining immunity.

### v2.1.0 (Jackpot Protocols & Audio Dimming)
- **Jackpot Audio Fixed**: Realigned slot machine audio pathways (`slotmachine`, `jackpot`, and `jackpotloop` files loaded properly).
- **Dynamic Music Dimming**: Game music dims to 35% during standard item SFX, and to 5% (almost muted) while the Jackpot looping immunity theme is active.
- **Inventory Icon Fix**: Jackpot item now successfully renders a golden Coins icon in inventory, loot, and debug screens.
- **Drop Rate Balancing**:
  - Normal Mode: Jackpot is a rare drop (2.0%) just above Totem (1.0%).
  - Hard Mode: Totem (1.0%) and Jackpot (1.0%) are equal rarity.
- **Debug Relocation**: Reorganized Developer console panel, renaming the 'Tarot' section to 'Item Power' and moving the Jackpot forced win cheats there.
 
---

## 🏆 Credits & Acknowledgments

This project is a fan-made, open-source tribute built to explore web-based 3D graphics and real-time multiplayer implementation, deeply inspired by the tabletop suspense of the original game[cite: 1].


### 🎨 Original Concept
*   **Mike Klubnika** ([Official Website](https://mikeklubnika.com/) / [Itch.io](https://mikeklubnika.itch.io/)) — The brilliant mind behind the official **Buckshot Roulette**. This project exists purely out of admiration for his work. Please support the official release on [Steam](https://store.steampowered.com/app/283550/Buckshot_Roulette/) and [Itch.io](https://mikeklubnika.itch.io/buckshot-roulette)[cite: 1].

### 🎨 Asset Credits
*   Dealer model by <https://sketchfab.com/VibaPop>.
*   Hand model by <https://sketchfab.com/bttkller>.

### 🔊 Audio & SFX
*   **Audio credit**: Game audio inspired by / attributed to <https://github.com/uncreativeCultist/buckshot-decomp-public>

### 🛠️ Built With
*   [React](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) — Powering the reactive state machine and type-safe gameplay loop[cite: 1].
*   [Three.js](https://threejs.org/) & [React Three Fiber](https://github.com/pmndrs/react-three-fiber) — Rendering the immersive, real-time 3D tabletop environment[cite: 1].
*   [Tailwind CSS](https://tailwindcss.com/) — Driving the sleek, responsive UI overlay systems[cite: 1].

---

### ⚠️ Asset & Content Notice
> **Notice:** All visual interfaces, 3D environments, and core engineering blocks inside **"aadishy/aadish-roulette"** are entirely custom-built from scratch[cite: 1]. 
> 
> The background tracks and certain item sound effects used during this development phase were found publicly online[cite: 1]. If you are the copyright holder of any audio asset used in this codebase and would like it removed or explicitly attributed, please open a formal issue directly on the [GitHub Repository](https://github.com/aadishy/aadish-roulette) for immediate removal[cite: 1].
