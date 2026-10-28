
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
    .setDescription("Membuat struktur EntongStore otomatis")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator.bitfield.toString()
    ),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Membuat order Robux di EntongStore"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Menampilkan daftar harga Robux EntongStore")
].map(command => command.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering EntongStore slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(
      "Slash commands EntongStore berhasil didaftarkan."
    );
  } catch (error) {
    console.error("Gagal mendaftarkan slash commands:", error);
  }
})();
