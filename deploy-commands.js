
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "Lengkapi DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID di file .env"
  );
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Pasang panel pembelian EntongStore"),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buat tiket pesanan Robux"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Lihat daftar harga Robux EntongStore")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function main() {
  try {
    console.log("Mendaftarkan command EntongStore...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Slash command berhasil didaftarkan!");
  } catch (error) {
    console.error("Gagal mendaftarkan command:", error);
    process.exitCode = 1;
  }
}

main();
