
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

// Daftar slash command ENTONGSTORE
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Membuat struktur server ENTONGSTORE otomatis")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

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
    console.error(
      "ERROR: Periksa DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID di file .env"
    );
    process.exitCode = 1;
    return;
  }

  const rest = new REST({ version: "10" })
    .setToken(token);

  console.log("Mengirim slash command ENTONGSTORE...");

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("====================================");
  console.log("ENTONGSTORE: DEPLOY BERHASIL!");
  console.log("Command tersedia: /setup, /buy, /price");
  console.log("====================================");
}

main().catch(error => {
  console.error("DEPLOY GAGAL:");
  console.error(error);
  process.exitCode = 1;
});
