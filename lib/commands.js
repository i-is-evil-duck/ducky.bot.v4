const fs = require('fs');
const path = require('path');

const config = require('../config.json');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function collectCommands() {
  const collected = [];

  const categories = fs
    .readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const category of categories) {
    const categoryDir = path.join(COMMANDS_DIR, category);
    const files = fs.readdirSync(categoryDir).filter((file) => file.endsWith('.js'));

    for (const file of files) {
      const fullPath = path.join(categoryDir, file);
      const command = require(fullPath);

      if (!command.data || typeof command.data.name !== 'string' || typeof command.run !== 'function') {
        console.warn(`⚠️  Invalid command file (needs \`data\` + \`run\`): ${path.join(category, file)}`);
        continue;
      }

      command.category = category;
      command.categoryName = config.categoryNames?.[category] ?? category;
      command.cooldown = command.cooldown ?? config.defaultCooldown ?? 3000;

      collected.push(command);
    }
  }

  return collected;
}

function categoryTitle(category) {
  return config.categoryNames?.[category] ?? category;
}

module.exports = { collectCommands, categoryTitle, COMMANDS_DIR };