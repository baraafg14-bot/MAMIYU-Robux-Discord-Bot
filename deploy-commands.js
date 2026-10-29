
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Membuat struktur server ENTONGSTORE otomatis")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Membuka proses order Robux ENTONGSTORE"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Menampilkan daftar harga Robux ENTONGSTORE")
].map(command => command.toJSON());

async function deployCommands() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error(
      "DISCORD_TOKEN, CLIENT_ID, atau GUILD_ID belum diisi di .env"
    );
  }

  const rest = new REST({ version: "10" })
    .setToken(DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash command ENTONGSTORE berhasil didaftarkan!");
}

deployCommands().catch(error => {
  console.error("❌ Gagal deploy slash command:", error);
  process.exitCode = 1;
});
