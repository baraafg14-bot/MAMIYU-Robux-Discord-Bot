
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Membuat struktur server ENTONGSTORE otomatis"),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Membuka proses order Robux ENTONGSTORE"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Menampilkan daftar harga Robux ENTONGSTORE")
].map(command => command.toJSON());

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error(
      "DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID wajib diisi di file .env"
    );
  }

  const rest = new REST({ version: "10" }).setToken(token);

  console.log("Sedang mendaftarkan command ENTONGSTORE...");

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("==================================");
  console.log("ENTONGSTORE DEPLOY BERHASIL!");
  console.log("Command: /setup, /buy, /price");
  console.log("==================================");
}

deployCommands().catch(error => {
  console.error("DEPLOY GAGAL!");
  console.error(error);
  process.exitCode = 1;
});
