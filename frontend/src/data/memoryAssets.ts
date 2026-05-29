export type MemoryAsset = {
  id: string;
  filename: string;
  label: string;
  mediaPath: string; // served via /media/memory-assets/
};

// 68 unique SVG assets from /assets/memory-assets/
export const MEMORY_ASSETS: MemoryAsset[] = [
  { id: 'alpaca',       filename: 'alpaca-svgrepo-com.svg',                        label: 'Alpaca',        mediaPath: '/media/memory-assets/alpaca-svgrepo-com.svg' },
  { id: 'deer',         filename: 'animals-christmas-deer-svgrepo-com.svg',         label: 'Deer',          mediaPath: '/media/memory-assets/animals-christmas-deer-svgrepo-com.svg' },
  { id: 'tarsier',      filename: 'animals-philippine-tarsier-svgrepo-com.svg',     label: 'Tarsier',       mediaPath: '/media/memory-assets/animals-philippine-tarsier-svgrepo-com.svg' },
  { id: 'rat',          filename: 'animals-rat-svgrepo-com.svg',                    label: 'Rat',           mediaPath: '/media/memory-assets/animals-rat-svgrepo-com.svg' },
  { id: 'anteater',     filename: 'anteater-svgrepo-com.svg',                       label: 'Anteater',      mediaPath: '/media/memory-assets/anteater-svgrepo-com.svg' },
  { id: 'apple',        filename: 'apple-svgrepo-com.svg',                          label: 'Apple',         mediaPath: '/media/memory-assets/apple-svgrepo-com.svg' },
  { id: 'avocado',      filename: 'avocado-svgrepo-com.svg',                        label: 'Avocado',       mediaPath: '/media/memory-assets/avocado-svgrepo-com.svg' },
  { id: 'banana',       filename: 'banana-svgrepo-com.svg',                         label: 'Banana',        mediaPath: '/media/memory-assets/banana-svgrepo-com.svg' },
  { id: 'beetle',       filename: 'beetle-svgrepo-com.svg',                         label: 'Beetle',        mediaPath: '/media/memory-assets/beetle-svgrepo-com.svg' },
  { id: 'boxing',       filename: 'boxing-svgrepo-com.svg',                         label: 'Boxing',        mediaPath: '/media/memory-assets/boxing-svgrepo-com.svg' },
  { id: 'butterfly',    filename: 'butterfly-svgrepo-com.svg',                      label: 'Butterfly',     mediaPath: '/media/memory-assets/butterfly-svgrepo-com.svg' },
  { id: 'camel',        filename: 'camel-svgrepo-com.svg',                          label: 'Camel',         mediaPath: '/media/memory-assets/camel-svgrepo-com.svg' },
  { id: 'cat',          filename: 'cat-svgrepo-com.svg',                            label: 'Cat',           mediaPath: '/media/memory-assets/cat-svgrepo-com.svg' },
  { id: 'chameleon',    filename: 'chameleon-svgrepo-com.svg',                      label: 'Chameleon',     mediaPath: '/media/memory-assets/chameleon-svgrepo-com.svg' },
  { id: 'cherry',       filename: 'cherry-svgrepo-com.svg',                         label: 'Cherry',        mediaPath: '/media/memory-assets/cherry-svgrepo-com.svg' },
  { id: 'cobra',        filename: 'cobra-svgrepo-com.svg',                          label: 'Cobra',         mediaPath: '/media/memory-assets/cobra-svgrepo-com.svg' },
  { id: 'coffee',       filename: 'coffee-svgrepo-com.svg',                         label: 'Coffee',        mediaPath: '/media/memory-assets/coffee-svgrepo-com.svg' },
  { id: 'crab',         filename: 'crab-svgrepo-com.svg',                           label: 'Crab',          mediaPath: '/media/memory-assets/crab-svgrepo-com.svg' },
  { id: 'crocodile',    filename: 'crocodile-svgrepo-com.svg',                      label: 'Crocodile',     mediaPath: '/media/memory-assets/crocodile-svgrepo-com.svg' },
  { id: 'dog',          filename: 'dog-svgrepo-com.svg',                            label: 'Dog',           mediaPath: '/media/memory-assets/dog-svgrepo-com.svg' },
  { id: 'duck',         filename: 'duck-svgrepo-com.svg',                           label: 'Duck',          mediaPath: '/media/memory-assets/duck-svgrepo-com.svg' },
  { id: 'dumbbell',     filename: 'dumbbel-svgrepo-com.svg',                        label: 'Dumbbell',      mediaPath: '/media/memory-assets/dumbbel-svgrepo-com.svg' },
  { id: 'elephant',     filename: 'elephant-svgrepo-com.svg',                       label: 'Elephant',      mediaPath: '/media/memory-assets/elephant-svgrepo-com.svg' },
  { id: 'fish',         filename: 'fish-svgrepo-com.svg',                           label: 'Fish',          mediaPath: '/media/memory-assets/fish-svgrepo-com.svg' },
  { id: 'frog',         filename: 'frog-svgrepo-com.svg',                           label: 'Frog',          mediaPath: '/media/memory-assets/frog-svgrepo-com.svg' },
  { id: 'giraffe',      filename: 'giraffe-svgrepo-com.svg',                        label: 'Giraffe',       mediaPath: '/media/memory-assets/giraffe-svgrepo-com.svg' },
  { id: 'grape',        filename: 'grape-svgrepo-com.svg',                          label: 'Grape',         mediaPath: '/media/memory-assets/grape-svgrepo-com.svg' },
  { id: 'hippo',        filename: 'hippo-svgrepo-com.svg',                          label: 'Hippo',         mediaPath: '/media/memory-assets/hippo-svgrepo-com.svg' },
  { id: 'husky',        filename: 'husky-svgrepo-com.svg',                          label: 'Husky',         mediaPath: '/media/memory-assets/husky-svgrepo-com.svg' },
  { id: 'kiwi',         filename: 'kiwi-fruit-svgrepo-com.svg',                     label: 'Kiwi',          mediaPath: '/media/memory-assets/kiwi-fruit-svgrepo-com.svg' },
  { id: 'lemon',        filename: 'lemon-svgrepo-com.svg',                          label: 'Lemon',         mediaPath: '/media/memory-assets/lemon-svgrepo-com.svg' },
  { id: 'lion',         filename: 'lion-svgrepo-com.svg',                           label: 'Lion',          mediaPath: '/media/memory-assets/lion-svgrepo-com.svg' },
  { id: 'manatee',      filename: 'manatee-svgrepo-com.svg',                        label: 'Manatee',       mediaPath: '/media/memory-assets/manatee-svgrepo-com.svg' },
  { id: 'panda-cat',    filename: 'mianyang-svgrepo-com.svg',                       label: 'Mianyang',      mediaPath: '/media/memory-assets/mianyang-svgrepo-com.svg' },
  { id: 'milk',         filename: 'milk-svgrepo-com.svg',                           label: 'Milk',          mediaPath: '/media/memory-assets/milk-svgrepo-com.svg' },
  { id: 'monkey',       filename: 'monkey-svgrepo-com.svg',                         label: 'Monkey',        mediaPath: '/media/memory-assets/monkey-svgrepo-com.svg' },
  { id: 'mouse',        filename: 'mouse-svgrepo-com.svg',                          label: 'Mouse',         mediaPath: '/media/memory-assets/mouse-svgrepo-com.svg' },
  { id: 'octopus',      filename: 'octopus-svgrepo-com.svg',                        label: 'Octopus',       mediaPath: '/media/memory-assets/octopus-svgrepo-com.svg' },
  { id: 'ostrich',      filename: 'ostrich-svgrepo-com.svg',                        label: 'Ostrich',       mediaPath: '/media/memory-assets/ostrich-svgrepo-com.svg' },
  { id: 'owl',          filename: 'owl-svgrepo-com.svg',                            label: 'Owl',           mediaPath: '/media/memory-assets/owl-svgrepo-com.svg' },
  { id: 'panda',        filename: 'panda-svgrepo-com.svg',                          label: 'Panda',         mediaPath: '/media/memory-assets/panda-svgrepo-com.svg' },
  { id: 'peach',        filename: 'peach-svgrepo-com.svg',                          label: 'Peach',         mediaPath: '/media/memory-assets/peach-svgrepo-com.svg' },
  { id: 'pelican',      filename: 'pelican-svgrepo-com.svg',                        label: 'Pelican',       mediaPath: '/media/memory-assets/pelican-svgrepo-com.svg' },
  { id: 'penguin',      filename: 'penguin-svgrepo-com.svg',                        label: 'Penguin',       mediaPath: '/media/memory-assets/penguin-svgrepo-com.svg' },
  { id: 'pig',          filename: 'pig-svgrepo-com.svg',                            label: 'Pig',           mediaPath: '/media/memory-assets/pig-svgrepo-com.svg' },
  { id: 'eggs',         filename: 'poached-eggs-svgrepo-com.svg',                   label: 'Eggs',          mediaPath: '/media/memory-assets/poached-eggs-svgrepo-com.svg' },
  { id: 'raccoon',      filename: 'raccoon-svgrepo-com.svg',                        label: 'Raccoon',       mediaPath: '/media/memory-assets/raccoon-svgrepo-com.svg' },
  { id: 'rhino',        filename: 'rhino-svgrepo-com.svg',                          label: 'Rhino',         mediaPath: '/media/memory-assets/rhino-svgrepo-com.svg' },
  { id: 'rooster',      filename: 'rooster-svgrepo-com.svg',                        label: 'Rooster',       mediaPath: '/media/memory-assets/rooster-svgrepo-com.svg' },
  { id: 'running',      filename: 'running-svgrepo-com.svg',                        label: 'Running',       mediaPath: '/media/memory-assets/running-svgrepo-com.svg' },
  { id: 'stingray',     filename: 'sea-ray-svgrepo-com.svg',                        label: 'Stingray',      mediaPath: '/media/memory-assets/sea-ray-svgrepo-com.svg' },
  { id: 'shark',        filename: 'shark-svgrepo-com.svg',                          label: 'Shark',         mediaPath: '/media/memory-assets/shark-svgrepo-com.svg' },
  { id: 'sloth',        filename: 'sloth-svgrepo-com.svg',                          label: 'Sloth',         mediaPath: '/media/memory-assets/sloth-svgrepo-com.svg' },
  { id: 'snake',        filename: 'snake-svgrepo-com.svg',                          label: 'Snake',         mediaPath: '/media/memory-assets/snake-svgrepo-com.svg' },
  { id: 'soda',         filename: 'soda-water-svgrepo-com.svg',                     label: 'Soda',          mediaPath: '/media/memory-assets/soda-water-svgrepo-com.svg' },
  { id: 'spider',       filename: 'spider-svgrepo-com.svg',                         label: 'Spider',        mediaPath: '/media/memory-assets/spider-svgrepo-com.svg' },
  { id: 'squirrel',     filename: 'squirrel-svgrepo-com.svg',                       label: 'Squirrel',      mediaPath: '/media/memory-assets/squirrel-svgrepo-com.svg' },
  { id: 'steak',        filename: 'steak-svgrepo-com.svg',                          label: 'Steak',         mediaPath: '/media/memory-assets/steak-svgrepo-com.svg' },
  { id: 'swan',         filename: 'swan-svgrepo-com.svg',                           label: 'Swan',          mediaPath: '/media/memory-assets/swan-svgrepo-com.svg' },
  { id: 'cow',          filename: 'the-cow-svgrepo-com.svg',                        label: 'Cow',           mediaPath: '/media/memory-assets/the-cow-svgrepo-com.svg' },
  { id: 'tiger',        filename: 'tiger-svgrepo-com.svg',                          label: 'Tiger',         mediaPath: '/media/memory-assets/tiger-svgrepo-com.svg' },
  { id: 'toucan',       filename: 'toucan-svgrepo-com.svg',                         label: 'Toucan',        mediaPath: '/media/memory-assets/toucan-svgrepo-com.svg' },
  { id: 'turtle',       filename: 'turtle-svgrepo-com.svg',                         label: 'Turtle',        mediaPath: '/media/memory-assets/turtle-svgrepo-com.svg' },
  { id: 'watermelon',   filename: 'watermelon-svgrepo-com.svg',                     label: 'Watermelon',    mediaPath: '/media/memory-assets/watermelon-svgrepo-com.svg' },
  { id: 'scale',        filename: 'weighing-scale-svgrepo-com.svg',                 label: 'Scale',         mediaPath: '/media/memory-assets/weighing-scale-svgrepo-com.svg' },
  { id: 'whale',        filename: 'whale-svgrepo-com.svg',                          label: 'Whale',         mediaPath: '/media/memory-assets/whale-svgrepo-com.svg' },
  { id: 'rabbit',       filename: 'white-rabbit-svgrepo-com.svg',                   label: 'Rabbit',        mediaPath: '/media/memory-assets/white-rabbit-svgrepo-com.svg' },
  { id: 'yogurt',       filename: 'yogurt-svgrepo-com.svg',                         label: 'Yogurt',        mediaPath: '/media/memory-assets/yogurt-svgrepo-com.svg' },
];

/** Pick N unique random assets from the catalog, avoiding already-used IDs */
export function pickRandomAssets(count: number, excludeIds: string[] = []): MemoryAsset[] {
  const available = MEMORY_ASSETS.filter((a) => !excludeIds.includes(a.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Number of pairs needed for each grid size */
export const GRID_PAIR_COUNTS: Record<string, number> = {
  '2x2': 2,
  '4x4': 4,
  '6x6': 6,
};

/** Number of columns for each grid size */
export const GRID_COLS: Record<string, number> = {
  '2x2': 2,
  '4x4': 4,
  '6x6': 4,
};
