require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===============================
// HELPER
// ===============================

function money(n) {
  return new Intl.NumberFormat("id-ID").format(Number(n));
}

function makeId() {
  return (
    "RBX-" +
    Math.random().toString(36).slice(2, 7).toUpperCase() +
    "-" +
    Date.now().toString().slice(-4)
  );
}

function staffOnly(member) {
  return member?.roles?.cache?.has(config.roles.staff);
}

async function sendLog(guild, title, description, color = 0x8b2cff) {
  const id = config.channels?.orderLogs;

  if (!id) return;

  const ch = await guild.channels.fetch(id).catch(() => null);

  if (!ch) return;

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
    ]
  }).catch(() => {});
}


// ===============================
// UPDATE STATUS ORDER
// ===============================

async function updateOrderStatus(channel, orderId, status) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);

  if (!messages) return null;

  const orderMessage = messages.find(msg =>
    msg.embeds?.some(embed =>
      embed.title?.includes(orderId)
    )
  );

  if (!orderMessage) return null;

  const oldEmbed = orderMessage.embeds[0];

  const newEmbed = EmbedBuilder.from(oldEmbed);

  const fields = oldEmbed.fields.map(field => {
    if (field.name === "📌 Status") {
      return {
        ...field,
        value: status
      };
    }

    return field;
  });

  newEmbed.setFields(fields);

  await orderMessage.edit({
    embeds: [newEmbed]
  }).catch(() => {});

  return orderMessage;
}


// ===============================
// READY
// ===============================

client.once("ready", () => {
  console.log(`================================`);
  console.log(`MAMIYU BOT ONLINE`);
  console.log(`Login sebagai: ${client.user.tag}`);
  console.log(`================================`);
});


// ===============================
// INTERACTION
// ===============================

client.on("interactionCreate", async (interaction) => {
  try {

    // =====================================================
    // SLASH COMMAND
    // =====================================================

    if (interaction.isChatInputCommand()) {

      // =========================
      // /setup
      // =========================

      if (interaction.commandName === "setup") {

        if (
          !interaction.memberPermissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply({
            content: "❌ Hanya administrator yang dapat menjalankan setup.",
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;

        // =========================
        // STAFF ROLE
        // =========================

        let staffRole = guild.roles.cache.find(
          r => r.name === "MAMIYU STAFF"
        );

        if (!staffRole) {
          staffRole = await guild.roles.create({
            name: "MAMIYU STAFF",
            color: 0x8b2cff,
            reason: "MAMIYU Store setup"
          });
        }

        config.roles.staff = staffRole.id;

        // =========================
        // CATEGORY
        // =========================

        const findOrCreateCategory = async (name) => {

          let c = guild.channels.cache.find(
            x =>
              x.type === ChannelType.GuildCategory &&
              x.name === name
          );

          if (!c) {
            c = await guild.channels.create({
              name,
              type: ChannelType.GuildCategory
            });
          }

          return c;
        };

        // =========================
        // CHANNEL
        // =========================

        const findOrCreateText = async (
          name,
          parent,
          opts = {}
        ) => {

          let c = guild.channels.cache.find(
            x =>
              x.type === ChannelType.GuildText &&
              x.name === name
          );

          if (!c) {
            c = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent,
              ...opts
            });
          }

          return c;
        };

        const info =
          await findOrCreateCategory("📌 INFORMATION");

        const store =
          await findOrCreateCategory("🛒 ROBUX STORE");

        const orders =
          await findOrCreateCategory("🎫 ORDERS");

        const staff =
          await findOrCreateCategory("🔐 STAFF");

        const announcement =
          await findOrCreateText(
            "📢・announcement",
            info
          );

        const rules =
          await findOrCreateText(
            "📜・rules",
            info
          );

        const priceList =
          await findOrCreateText(
            "💰・price-list",
            info
          );

        const createOrder =
          await findOrCreateText(
            "🛍️・create-order",
            store
          );

        const testimonials =
          await findOrCreateText(
            "⭐・testimonials",
            store
          );

        const orderLogs =
          await findOrCreateText(
            "📋・order-logs",
            staff
          );

        const paymentLogs =
          await findOrCreateText(
            "💳・payment-logs",
            staff
          );

        const staffChat =
          await findOrCreateText(
            "🛠️・staff-chat",
            staff
          );

        // =========================
        // SAVE CONFIG
        // =========================

        config.channels = {
          announcement: announcement.id,
          rules: rules.id,
          priceList: priceList.id,
          createOrder: createOrder.id,
          testimonials: testimonials.id,
          orderLogs: orderLogs.id,
          paymentLogs: paymentLogs.id,
          staffChat: staffChat.id,
          ordersCategory: orders.id
        };

        fs.writeFileSync(
          "./config.json",
          JSON.stringify(config, null, 2)
        );

        // =========================
        // PRICE LIST
        // =========================

        const priceEmbed = new EmbedBuilder()
          .setTitle("💜 MAMIYU STORE — TOP UP ROBUX")
          .setDescription(
            "Harga eceran Robux • Via Username\n\n" +
            "Pilih nominal melalui `/buy` untuk membuat order."
          )
          .setColor(0x8b2cff)
          .setFooter({
            text: "MAMIYU STORE • Trusted • Fast • Safe"
          });

        const priceLines = Object.entries(config.prices)
          .map(
            ([r, p]) =>
              `**${money(r)} RBX** → **Rp ${money(p)}**`
          )
          .join("\n");

        priceEmbed.addFields({
          name: "💎 PRICE LIST",
          value: priceLines.slice(0, 1024)
        });

        await priceList.send({
          embeds: [priceEmbed]
        }).catch(() => {});

        // =========================
        // BUY BUTTON
        // =========================

        const buyEmbed = new EmbedBuilder()
          .setTitle("🛒 MAMIYU ROBUX STORE")
          .setDescription(
            "Butuh Robux? Buat order langsung di sini.\n\n" +
            "⚡ Proses cepat\n" +
            "🔒 Aman & terpercaya\n" +
            "💜 Pelayanan ramah\n\n" +
            "Klik tombol **BUY ROBUX** untuk mulai."
          )
          .setColor(0x8b2cff);

        const row =
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("buy_robux")
              .setLabel("BUY ROBUX")
              .setEmoji("🛒")
              .setStyle(ButtonStyle.Primary)
          );

        await createOrder.send({
          embeds: [buyEmbed],
          components: [row]
        }).catch(() => {});

        await interaction.editReply(
          "✅ Setup MAMIYU Store selesai."
        );

        return;
      }


      // =========================
      // /price
      // =========================

      if (interaction.commandName === "price") {

        const lines = Object.entries(config.prices)
          .map(
            ([r, p]) =>
              `**${money(r)} RBX** → **Rp ${money(p)}**`
          )
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("💜 MAMIYU STORE — PRICE LIST")
              .setDescription(lines)
              .setColor(0x8b2cff)
              .setFooter({
                text: "Via Username • MAMIYU STORE"
              })
          ]
        });
      }


      // =========================
      // /buy
      // =========================

      if (interaction.commandName === "buy") {

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId("robux_amount")
            .setPlaceholder(
              "Pilih nominal Robux..."
           
