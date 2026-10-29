
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const required = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "GUILD_ID"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`${key} belum diisi di .env`);
    process.exit(1);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup server ENTONGSTORE")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Mulai order Robux"),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Lihat pricelist ENTONGSTORE")
].map(command => command.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

async function deploy() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands ENTONGSTORE berhasil didaftarkan.");
  } catch (error) {
    console.error("❌ Gagal deploy commands:", error);
    process.exitCode = 1;
  }
}

deploy();
