# Phaser 2.5D Game Demo

A 2.5D isometric game demo built with Phaser.io featuring:

- **20x20 Isometric Map**: Generated terrain with highlands (green), water (blue), and walkable floors (brown)
- **Player Character**: Green circle that can be controlled by clicking on walkable tiles
- **Enemy AI**: 5 red enemies that wander randomly and chase/attack the player when in sight range
- **Combat System**: Player can punch enemies by getting close to them (auto-attack)

## Installation

```bash
npm install
```

## Running the Game

```bash
npm start
```

Then open your browser to `http://localhost:8080`

## How to Play

- **Move**: Click on any walkable tile (brown or green) to move the player
- **Attack**: Get close to enemies to automatically punch them
- **Objective**: Defeat all enemies while avoiding their attacks!

## Game Features

- Isometric 2.5D tile rendering
- Pathfinding and click-to-move controls
- Enemy AI with wandering and chase behaviors
- Sight-based enemy detection
- Simple combat mechanics
- Dynamic depth sorting for proper layering