
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

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error(
      "Periksa DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID di file .env"
    );
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  console.log("Deploy command ENTONGSTORE dimulai...");

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("ENTONGSTORE DEPLOY BERHASIL!");
}

main().catch(error => {
  console.error("DEPLOY GAGAL:", error);
  process.exitCode = 1;
});
