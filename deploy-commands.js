
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
    .setDescription("Membuka proses order Robux"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Menampilkan daftar harga Robux")
].map(command => command.toJSON());

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error(
      "DISCORD_TOKEN, CLIENT_ID, atau GUILD_ID belum diisi di .env"
    );
  }

  const rest = new REST({ version: "10" })
    .setToken(token);

  console.log("Memulai deploy command ENTONGSTORE...");

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("ENTONGSTORE: DEPLOY BERHASIL!");
  console.log("Command tersedia: /setup, /buy, /price");
}

main().catch(error => {
  console.error("Deploy gagal:", error.message);
  process.exitCode = 1;
});
