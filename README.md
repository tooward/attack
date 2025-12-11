# Development requirements
http-server
phaser

# Running the app
Run using the http-server: "npx http-server". This will serve the index.html file.

    <script src="//cdn.jsdelivr.net/npm/phaser@3.88.2/dist/phaser.js"></script>

# Procedural Generation Logic

## Phaser Definitions

Tiles: In Phaser, a tile represents a single graphic element that makes up your game world. This could be a piece of ground, a wall, a rock, or any other visual element. Think of tiles as individual LEGO bricks that you can use to build larger structures.
In Tiled, these are equivalent to the individual images in your tileset. You select an image from your tileset and place it on the map grid.

Tilesets: A tileset is a collection of related tiles that share common characteristics. For example, you might have a tileset for ground textures, another for wall textures, and so on. In Phaser, a tileset is represented by a Phaser.Tilemaps.Tileset object.
In Tiled, this is equivalent to creating a new tileset in the editor, where you add multiple images that can be used together to create your map.

Tilemap: A tilemap represents the arrangement of tiles within your game world. It's essentially a 2D grid of tiles, where each cell contains a specific tile from your tileset. In Phaser, a tilemap is represented by a Phaser.Tilemaps.Tilemap object.
In Tiled, this is equivalent to creating a new map in the editor, where you arrange tiles from your tilesets onto a grid to create your game world.

Layers: Layers are used to organize and separate different types of tiles within your tilemap. For example, you might have one layer for ground tiles, another for wall tiles, and so on. In Phaser, layers are represented by Phaser.Tilemaps.Layer objects.
In Tiled, this is equivalent to creating multiple layers in your map, where each layer can contain different types of tiles. You can then control the visibility, opacity, and other properties of each layer independently.

Map: The overall environment that your character moves through is indeed referred to as a "map" in Phaser. A map typically consists of one or more tilemaps, which are arranged together to create the game world.

## Implementing the logic

To build up from individual tiles to maps, you would follow these steps:
 Create a tileset by loading your tile images into Phaser.
 Create a tilemap by defining the arrangement of tiles within your game world.
 Add layers to your tilemap to organize and separate different types of tiles.
 Arrange tiles within each layer to create the desired layout for your map.
 Combine multiple tilemaps (if needed) to create the overall environment that your character moves through.

 Here's a high-level overview of how I would architect the procedural generation of ground in the map:
 BiomeDefinition: This class represents a biome definition, which includes properties such as:

 Name
 Description
 Tileset metadata (e.g., tile size, spacing)
 Tile distribution rules (e.g., frequency, probability)
 TilesetManager: This class is responsible for loading and managing the tileset image and its corresponding metadata JSON file. It provides methods to:
 Load the tileset image
 Parse the tileset metadata from the JSON file
 Get a specific tile by its ID or name
 GroundGenerator: This class generates the ground tiles based on the biome definition and tileset data. It uses algorithms such as:
 Perlin noise
 Voronoi diagrams
 Random number generation to create a natural-looking terrain. The class has methods to:
 Initialize the generator with a biome definition and tileset manager
 Generate a 2D array of tile IDs or names representing the ground tiles
 MapGenerator: This class generates the entire map, including the ground, by combining multiple biomes and using the GroundGenerator to create the terrain for each biome.
 BiomeManager: This class manages a collection of biome definitions and provides methods to:
 Get a biome definition by its name or ID
 Create a new biome definition