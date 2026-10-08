const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');
const { reminders } = require('./db');
const { formatDuration } = require('./helpers');

const POLL_INTERVAL = 30_000;

let timer = null;

function buildReminderEmbed(reminder, client) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('Reminder')
    .setDescription(reminder.message)
    .setFooter({ text: `${client.user.tag} | reminder #${reminder.id}` })
    .setTimestamp(reminder.due_at);
}

async function deliver(client, reminder) {
  const user = await client.users.fetch(reminder.user_id).catch(() => null);
  if (!user) {
    reminders.markFailed(reminder.id);
    return;
  }

  await user.send({ embeds: [buildReminderEmbed(reminder, client)] });
  reminders.markSent(reminder.id);
}

async function tick(client) {
  const due = reminders.due();
  for (const reminder of due) {
    try {
      await deliver(client, reminder);
    } catch (error) {
      console.error(`Failed to deliver reminder #${reminder.id}:`, error.message);
      reminders.markFailed(reminder.id);
    }
  }
}

function start(client) {
  if (timer) return;
  const run = () => {
    tick(client).catch((error) => console.error('Reminder scheduler error:', error));
  };
  run();
  timer = setInterval(run, POLL_INTERVAL);
  timer.unref?.();
  console.log(`⏰ Reminder scheduler started (${POLL_INTERVAL / 1000}s interval)`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, formatDuration, config };