
require("dotenv").config();

const fs = require("fs");
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
  TextInputStyle,
  MessageFlags,
  Events
} = require("discord.js");

// ======================================================
// ENTONGSTORE CONFIG
// ======================================================

const STORE_NAME = "EntongStore";
const STAFF_ROLE_NAME = "ENTONG STAFF";
const CONFIG_FILE = "./config.json";
const ORDERS_FILE = "./orders.json";
const COLOR = 0x8b2cff;

const DEFAULT_PRICES = {
  "100": 17000,
  "500": 70000,
  "1000": 170000,
  "2000": 340000
};

const DEFAULT_METHODS = [
  "OVO",
  "GOPAY",
  "DANA",
  "BANK TRANSFER"
];

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("❌ config.json tidak ditemukan!");
  process.exit(1);
}

let config;

try {
  config = JSON.parse(
    fs.readFileSync(CONFIG_FILE, "utf8")
  );
} catch (error) {
  console.error("❌ config.json tidak valid:", error.message);
  process.exit(1);
}

// Gunakan pricelist EntongStore yang sudah ditentukan.
config.storeName = STORE_NAME;
config.currency = "IDR";
config.prices = DEFAULT_PRICES;
config.roles = config.roles || {};
config.channels = config.channels || {};

if (
  !Array.isArray(config.paymentMethods) ||
  config.paymentMethods.length === 0
) {
  config.paymentMethods = DEFAULT_METHODS;
}

if (config.paymentMethods.length > 5) {
  console.error("❌ Maksimal 5 metode pembayaran.");
  process.exit(1);
}

config.paymentAccounts = config.paymentAccounts || {};

for (const method of config.paymentMethods) {
  if (!config.paymentAccounts[method]) {
    config.paymentAccounts[method] = "Belum diatur";
  }
}

function saveConfig() {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

saveConfig();

// ======================================================
// ORDER DATABASE
// ======================================================

let orders = {};

if (fs.existsSync(ORDERS_FILE)) {
  try {
    orders = JSON.parse(
      fs.readFileSync(ORDERS_FILE, "utf8")
    );

    if (
      !orders ||
      typeof orders !== "object" ||
      Array.isArray(orders)
    ) {
      orders = {};
    }
  } catch (error) {
    console.error(
      "❌ orders.json tidak valid:",
      error.message
    );
    process.exit(1);
  }
}

function saveOrders() {
  fs.writeFileSync(
    ORDERS_FILE,
    JSON.stringify(orders, null, 2)
  );
}

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================================================
// UTILITIES
// ======================================================

function money(value) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value)
  );
}

function ephemeral(content) {
  return {
    content,
    flags: MessageFlags.Ephemeral
  };
}

function makeOrderId() {
  let id;

  do {
    id =
      "RBX-" +
      Math.random().toString(36).slice(2, 7).toUpperCase() +
      "-" +
      Date.now().toString().slice(-5);
  } while (orders[id]);

  return id;
}

function getPriceLines() {
  return Object.entries(config.prices)
    .map(
      ([amount, price]) =>
        `**${money(amount)} Robux** — **Rp ${money(price)}**`
    )
    .join("\n");
}

function priceEmbed() {
  return new EmbedBuilder()
    .setTitle("💜 ENTONGSTORE — PRICE LIST")
    .setDescription(getPriceLines())
    .setColor(COLOR)
    .setFooter({
      text: "EntongStore • Robux via Username"
    })
    .setTimestamp();
}

function isStaff(interaction) {
  const roleId = config.roles.staff;

  if (!roleId) return false;

  const member = interaction.member;

  if (member?.permissions?.has(
    PermissionFlagsBits.Administrator
  )) {
    return true;
  }

  return member?.roles?.cache?.has(roleId) || false;
}

function isOwner(interaction, order) {
  return interaction.user.id === order.userId;
}

function isOrderChannel(interaction, order) {
  return interaction.channelId === order.channelId;
}

function getOrder(orderId) {
  return orders[orderId] || null;
}

function activeOrder(order) {
  return !["COMPLETED", "CANCELLED"].includes(
    order.status
  );
}

// ======================================================
// STAFF ROLE
// ======================================================

async function getStaffRole(guild) {
  let role = null;

  if (config.roles.staff) {
    role = await guild.roles
      .fetch(config.roles.staff)
      .catch(() => null);
  }

  if (!role) {
    role = guild.roles.cache.find(
      item => item.name === STAFF_ROLE_NAME
    );
  }

  if (!role) {
    role = await guild.roles.create({
      name: STAFF_ROLE_NAME,
      color: COLOR,
      reason: `${STORE_NAME} staff role`
    });
  }

  config.roles.staff = role.id;
  saveConfig();

  return role;
}

// ======================================================
// CHANNEL HELPERS
// ======================================================

async function getChannel(guild, id) {
  if (!id) return null;

  return guild.channels.fetch(id).catch(() => null);
}

async function findCategory(guild, name) {
  let category = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === name
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

async function findText(guild, name, parent) {
  let channel = guild.channels.cache.find(
    item =>
      item.type === ChannelType.GuildText &&
      item.name === name
  );

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id
    });
  } else if (channel.parentId !== parent.id) {
    await channel.setParent(parent.id);
  }

  return channel;
}

// Buat atau perbarui pesan bot saat /setup dijalankan ulang.
async function upsertBotMessage(channel, title, payload) {
  const messages = await channel.messages
    .fetch({ limit: 50 })
    .catch(() => null);

  const existing = messages?.find(
    message =>
      message.author.id === client.user.id &&
      message.embeds.some(embed => embed.title === title)
  );

  if (existing) {
    return existing.edit(payload);
  }

  return channel.send(payload);
}

// ======================================================
// ORDER EMBEDS & LOGS
// ======================================================

function getStatusText(status) {
  const statuses = {
    WAITING_PAYMENT: "🟡 MENUNGGU PEMBAYARAN",
    PAYMENT_CLAIMED: "🟠 MENUNGGU VERIFIKASI",
    VERIFIED: "🟢 PEMBAYARAN TERVERIFIKASI",
    COMPLETED: "🎉 SELESAI",
    CANCELLED: "🔴 DIBATALKAN"
  };

  return statuses[status] || status;
}

function getStatusColor(status) {
  if (status === "COMPLETED" || status === "VERIFIED") {
    return 0x00c853;
  }

  if (status === "CANCELLED") {
    return 0xff0000;
  }

  if (status === "PAYMENT_CLAIMED") {
    return 0xffa500;
  }

  return COLOR;
}

function orderEmbed(order) {
  const embed = new EmbedBuilder()
    .setTitle(`🛒 ORDER ${order.id}`)
    .setColor(getStatusColor(order.status))
    .addFields(
      {
        name: "👤 Customer",
        value: `<@${order.userId}>`,
        inline: true
      },
      {
        name: "🎮 Roblox Username",
        value: `\`${order.username}\``,
        inline: true
      },
      {
        name: "💎 Robux",
        value: `${money(order.amount)} Robux`,
        inline: true
      },
      {
        name: "💰 Total",
        value: `Rp ${money(order.price)}`,
        inline: true
      },
      {
        name: "💳 Pembayaran",
        value: order.paymentMethod || "Belum dipilih",
        inline: true
      },
      {
        name: "📌 Status",
        value: getStatusText(order.status),
        inline: true
      },
      {
        name: "📝 Catatan",
        value: String(order.notes || "-").slice(0, 1000),
        inline: false
      }
    )
    .setFooter({
      text: `${STORE_NAME} • Jangan pernah membagikan password Roblox`
    })
    .setTimestamp(order.createdAt || Date.now());

  if (order.staffId) {
    embed.addFields({
      name: "👨‍💼 Staff",
      value: `<@${order.staffId}>`,
      inline: true
    });
  }

  return embed;
}

async function createOrderLog(guild, order) {
  const channel = await getChannel(
    guild,
    config.channels.orderLogs
  );

  if (!channel?.isTextBased()) return null;

  const message = await channel.send({
    embeds: [orderEmbed(order)]
  }).catch(error => {
    console.error("Gagal membuat order log:", error.message);
    return null;
  });

  if (message) {
    order.logMessageId = message.id;
    saveOrders();
  }

  return message;
}

async function updateOrderLog(guild, order) {
  const channel = await getChannel(
    guild,
    config.channels.orderLogs
  );

  if (!channel?.isTextBased()) return;

  if (order.logMessageId) {
    const message = await channel.messages
      .fetch(order.logMessageId)
      .catch(() => null);

    if (message) {
      await message.edit({
        embeds: [orderEmbed(order)]
      }).catch(() => {});
      return;
    }
  }

  await createOrderLog(guild, order);
}

async function persistOrder(guild, order) {
  saveOrders();
  await updateOrderLog(guild, order);
}

// ======================================================
// ROBUX MENUS & BUTTONS
// ======================================================

function robuxMenu() {
  return new StringSelectMenuBuilder()
    .setCustomId("robux_amount")
    .setPlaceholder("Pilih nominal Robux...")
    .addOptions(
      Object.entries(config.prices).map(
        ([amount, price]) => ({
          label: `${money(amount)} Robux`,
          description: `Rp ${money(price)}`,
          value: amount
        })
      )
    );
}

function paymentButtons(orderId) {
  const row = new ActionRowBuilder();

  config.paymentMethods.forEach((method, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`pay:${orderId}:${index}`)
        .setLabel(method)
        .setStyle(
          index === 0
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary
        )
    );
  });

  return row;
}

function paymentActionButtons(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`paid:${orderId}`)
      .setLabel("SAYA SUDAH BAYAR")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`close:${orderId}`)
      .setLabel("CANCEL ORDER")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );
}

// ======================================================
// READY
// ======================================================

client.once(Events.ClientReady, () => {
  console.log(
    `✅ ${STORE_NAME} BOT ONLINE sebagai ${client.user.tag}`
  );

  console.log(
    `📦 ${Object.keys(orders).length} order tersimpan.`
  );
});

// ======================================================
// INTERACTIONS
// ======================================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    // ==================================================
    // SLASH COMMANDS
    // ==================================================

    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      // ----------------------------------------------
      // /setup
      // ----------------------------------------------

      if (command === "setup") {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply(
            ephemeral("❌ Hanya administrator yang dapat menjalankan setup.")
          );
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const guild = interaction.guild;
        const staffRole = await getStaffRole(guild);

        const information = await findCategory(
          guild,
          "📌 INFORMATION"
        );

        const store = await findCategory(
          guild,
          "🛒 ROBUX STORE"
        );

        const ordersCategory = await findCategory(
          guild,
          "🎫 ORDERS"
        );

        const staffCategory = await findCategory(
          guild,
          "🔐 STAFF"
        );

        const announcement = await findText(
          guild, "📢・announcement", information
        );

        const rules = await findText(
          guild, "📜・rules", information
        );

        const priceList = await findText(
          guild, "💰・price-list", information
        );

        const createOrder = await findText(
          guild, "🛍️・create-order", store
        );

        const testimonials = await findText(
          guild, "⭐・testimonials", store
        );

        const orderLogs = await findText(
          guild, "📋・order-logs", staffCategory
        );

        const paymentLogs = await findText(
          guild, "💳・payment-logs", staffCategory
        );

        const staffChat = await findText(
          guild, "🛠️・staff-chat", staffCategory
        );

        config.channels = {
          announcement: announcement.id,
          rules: rules.id,
          priceList: priceList.id,
          createOrder: createOrder.id,
          testimonials: testimonials.id,
          orderLogs: orderLogs.id,
          paymentLogs: paymentLogs.id,
          staffChat: staffChat.id,
          ordersCategory: ordersCategory.id
        };

        saveConfig();

        await upsertBotMessage(
          priceList,
          "💜 ENTONGSTORE — PRICE LIST",
          { embeds: [priceEmbed()] }
        );

        const buyEmbed = new EmbedBuilder()
          .setTitle("🛒 ENTONGSTORE ROBUX")
          .setDescription(
            "Butuh Robux?\n\n" +
            "⚡ Proses order melalui tiket\n" +
            "🔒 Tiket privat untuk customer dan staff\n" +
            "💜 Pelayanan ramah\n\n" +
            "Klik **BUY ROBUX** untuk membuat pesanan."
          )
          .setColor(COLOR)
          .setFooter({
            text: "EntongStore • Jangan bagikan password Roblox"
          });

        const buyRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("buy_robux")
            .setLabel("BUY ROBUX")
            .setEmoji("🛒")
            .setStyle(ButtonStyle.Primary)
        );

        await upsertBotMessage(
          createOrder,
          "🛒 ENTONGSTORE ROBUX",
          {
            embeds: [buyEmbed],
            components: [buyRow]
          }
        );

        return interaction.editReply(
          `✅ Setup ${STORE_NAME} selesai.\n\n` +
          `👨‍💼 Staff Role: <@&${staffRole.id}>\n` +
          `💰 Pricelist sudah diperbarui.\n` +
          `🛒 Sistem order siap digunakan.`
        );
      }

      // ----------------------------------------------
      // /price
      // ----------------------------------------------

      if (command === "price") {
        return interaction.reply({
          embeds: [priceEmbed()]
        });
      }

      // ----------------------------------------------
      // /buy
      // ----------------------------------------------

      if (command === "buy") {
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle("💜 ENTONGSTORE — PILIH NOMINAL")
              .setDescription(
                "Pilih jumlah Robux yang ingin kamu beli."
              )
              .setColor(COLOR)
          ],
          components: [
            new ActionRowBuilder().addComponents(robuxMenu())
          ]
        });
      }
    }

    // ==================================================
    // BUY BUTTON
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "buy_robux"
    ) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle("💜 ENTONGSTORE — PILIH NOMINAL")
            .setDescription(
              "Pilih jumlah Robux yang ingin kamu order."
            )
            .setColor(COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(robuxMenu())
        ]
      });
    }

    // ==================================================
    // SELECT ROBUX & SHOW MODAL
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "robux_amount"
    ) {
      const amount = interaction.values[0];

      if (
        !Object.prototype.hasOwnProperty.call(
          config.prices,
          amount
        )
      ) {
        return interaction.reply(
          ephemeral("❌ Nominal Robux tidak valid.")
        );
      }

      const modal = new ModalBuilder()
        .setCustomId(`order_modal_${amount}`)
        .setTitle("ENTONGSTORE • DATA ORDER");

      const username = new TextInputBuilder()
        .setCustomId("roblox_username")
        .setLabel("Username Roblox")
        .setPlaceholder("Masukkan username Roblox")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(30);

      const notes = new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("Catatan (opsional)")
        .setPlaceholder("Contoh: proses secepatnya")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(300);

      modal.addComponents(
        new ActionRowBuilder().addComponents(username),
        new ActionRowBuilder().addComponents(notes)
      );

      return interaction.showModal(modal);
    }

    // ==================================================
    // SUBMIT ORDER MODAL
    // ==================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("order_modal_")
    ) {
      const amount = interaction.customId.slice(
        "order_modal_".length
      );

      if (
        !Object.prototype.hasOwnProperty.call(
          config.prices,
          amount
        )
      ) {
        return interaction.reply(
          ephemeral("❌ Nominal Robux tidak valid.")
        );
      }

      const username = interaction.fields
        .getTextInputValue("roblox_username")
        .trim();

      const notes = (
        interaction.fields.getTextInputValue("notes") || "-"
      ).trim();

      const price = config.prices[amount];

      if (
        !username ||
        !Number.isSafeInteger(price) ||
        price <= 0
      ) {
        return interaction.reply(
          ephemeral("❌ Data order tidak valid.")
        );
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      const guild = interaction.guild;
      const staffRole = await getStaffRole(guild);

      const category = await getChannel(
        guild,
        config.channels.ordersCategory
      );

      if (
        !category ||
        category.type !== ChannelType.GuildCategory
      ) {
        return interaction.editReply(
          "❌ Kategori order tidak ditemukan. Jalankan `/setup` lagi."
        );
      }

      const orderId = makeOrderId();

      const channel = await guild.channels.create({
        name: `order-${orderId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      const order = {
        id: orderId,
        guildId: guild.id,
        userId: interaction.user.id,
        username,
        amount: Number(amount),
        price,
        notes: notes || "-",
        paymentMethod: null,
        status: "WAITING_PAYMENT",
        staffId: null,
        channelId: channel.id,
        logMessageId: null,
        createdAt: Date.now()
      };

      orders[orderId] = order;
      saveOrders();

      const embed = new EmbedBuilder()
        .setTitle(`🛒 ORDER ${orderId}`)
        .setDescription(
          "Silakan pilih metode pembayaran di bawah.\n" +
          "Kirim bukti pembayaran di channel ini setelah transfer."
        )
        .setColor(COLOR)
        .addFields(
          {
            name: "👤 Customer",
            value: `<@${order.userId}>`,
            inline: true
          },
          {
            name: "🎮 Roblox Username",
            value: `\`${order.username}\``,
            inline: true
          },
          {
            name: "💎 Product",
            value: `${money(order.amount)} Robux`,
            inline: true
          },
          {
            name: "💰 Total",
            value: `Rp ${money(order.price)}`,
            inline: true
          },
          {
            name: "📝 Catatan",
            value: order.notes.slice(0, 1000),
            inline: false
          },
          {
            name: "📌 Status",
            value: getStatusText(order.status),
            inline: false
          }
        )
        .setFooter({
          text: "EntongStore • Jangan pernah kirim password Roblox"
        })
        .setTimestamp();

      await channel.send({
        content: `<@${order.userId}> <@&${staffRole.id}>`,
        embeds: [embed],
        components: [paymentButtons(orderId)]
      });

      await createOrderLog(guild, order);

      return interaction.editReply(
        `✅ Order berhasil dibuat!\n\n` +
        `🆔 **${orderId}**\n` +
        `📦 **${money(order.amount)} Robux**\n` +
        `💰 **Rp ${money(order.price)}**\n\n` +
        `👉 <#${channel.id}>`
      );
    }

    // ==================================================
    // CHOOSE PAYMENT METHOD
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pay:")
    ) {
      const [, orderId, indexText] =
        interaction.customId.split(":");

      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Data order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (!isOwner(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Hanya pemilik order yang dapat memilih pembayaran.")
        );
      }

      if (order.status !== "WAITING_PAYMENT") {
        return interaction.reply(
          ephemeral("❌ Order ini sudah tidak menunggu pembayaran.")
        );
      }

      const index = Number(indexText);
      const method = config.paymentMethods[index];

      if (!method) {
        return interaction.reply(
          ephemeral("❌ Metode pembayaran tidak ditemukan.")
        );
      }

      order.paymentMethod = method;
      saveOrders();

      const account =
        config.paymentAccounts[method] || "Belum diatur oleh admin.";

      const description =
        account === "Belum diatur"
          ? "⚠️ Admin belum mengatur rekening pembayaran ini."
          : `**Tujuan pembayaran:**\n${account}`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`💳 PEMBAYARAN • ${method}`)
            .setDescription(
              `${description}\n\n` +
              `**Total:** Rp ${money(order.price)}\n\n` +
              "Setelah membayar, kirim bukti pembayaran di channel order.\n" +
              "Lalu tekan **SAYA SUDAH BAYAR**."
            )
            .setColor(COLOR)
        ],
        components: [paymentActionButtons(orderId)]
      });
    }

    // ==================================================
    // CUSTOMER CLAIMS PAYMENT
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("paid:")
    ) {
      const orderId = interaction.customId.slice(5);
      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (!isOwner(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Hanya pemilik order yang dapat menekan tombol ini.")
        );
      }

      if (order.status !== "WAITING_PAYMENT") {
        return interaction.reply(
          ephemeral("❌ Pembayaran order ini sudah diproses.")
        );
      }

      if (!order.paymentMethod) {
        return interaction.reply(
          ephemeral("❌ Pilih metode pembayaran terlebih dahulu.")
        );
      }

      order.status = "PAYMENT_CLAIMED";
      await persistOrder(interaction.guild, order);

      const staffRole = await getStaffRole(interaction.guild);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify:${orderId}`)
          .setLabel("VERIFIKASI PEMBAYARAN")
          .setEmoji("🔎")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`cancel:${orderId}`)
          .setLabel("TOLAK / BATAL")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.channel.send({
        content:
          `🔔 <@&${staffRole.id}> Pembayaran diklaim untuk **${orderId}**.\n` +
          "Periksa bukti pembayaran sebelum melakukan verifikasi.",
        components: [row]
      });

      return interaction.reply(
        ephemeral("✅ Klaim pembayaran terkirim. Staff akan memeriksa bukti pembayaran.")
      );
    }

    // ==================================================
    // STAFF VERIFIES PAYMENT
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("verify:")
    ) {
      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral("❌ Hanya staff EntongStore yang dapat memverifikasi pembayaran.")
        );
      }

      const orderId = interaction.customId.slice(7);
      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (order.status !== "PAYMENT_CLAIMED") {
        return interaction.reply(
          ephemeral("❌ Order belum menunggu verifikasi pembayaran.")
        );
      }

      order.status = "VERIFIED";
      order.staffId = interaction.user.id;

      await persistOrder(interaction.guild, order);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`complete:${orderId}`)
          .setLabel("SELESAIKAN ORDER")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({
        content:
          `✅ Pembayaran **${orderId}** telah diverifikasi oleh <@${interaction.user.id}>.\n` +
          "Silakan proses pengiriman Robux.",
        components: [row]
      });

      return interaction.reply(
        ephemeral("✅ Pembayaran berhasil diverifikasi.")
      );
    }

    // ==================================================
    // COMPLETE ORDER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("complete:")
    ) {
      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral("❌ Hanya staff EntongStore yang dapat menyelesaikan order.")
        );
      }

      const orderId = interaction.customId.slice(9);
      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (order.status !== "VERIFIED") {
        return interaction.reply(
          ephemeral("❌ Pembayaran harus diverifikasi sebelum order selesai.")
        );
      }

      order.status = "COMPLETED";
      order.staffId = interaction.user.id;
      order.completedAt = Date.now();

      await persistOrder(interaction.guild, order);

      return interaction.reply(
        `🎉 **ORDER SELESAI!**\n\n` +
        `🆔 **${orderId}**\n` +
        `👤 <@${order.userId}>\n` +
        `💎 ${money(order.amount)} Robux\n` +
        `💰 Rp ${money(order.price)}\n\n` +
        `Staff: <@${interaction.user.id}>`
      );
    }

    // ==================================================
    // STAFF CANCELS ORDER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("cancel:")
    ) {
      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral("❌ Hanya staff EntongStore yang dapat membatalkan order.")
        );
      }

      const orderId = interaction.customId.slice(7);
      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (!activeOrder(order)) {
        return interaction.reply(
          ephemeral("❌ Order sudah selesai atau dibatalkan.")
        );
      }

      order.status = "CANCELLED";
      order.staffId = interaction.user.id;
      order.cancelledAt = Date.now();

      await persistOrder(interaction.guild, order);

      return interaction.reply(
        `🔴 Order **${orderId}** dibatalkan oleh <@${interaction.user.id}>.`
      );
    }

    // ==================================================
    // CUSTOMER CANCELS / CLOSES ORDER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("close:")
    ) {
      const orderId = interaction.customId.slice(6);
      const order = getOrder(orderId);

      if (!order) {
        return interaction.reply(
          ephemeral("❌ Order tidak ditemukan.")
        );
      }

      if (!isOrderChannel(interaction, order)) {
        return interaction.reply(
          ephemeral("❌ Tombol bukan milik channel order ini.")
        );
      }

      if (
        !isOwner(interaction, order) &&
        !isStaff(interaction)
      ) {
        return interaction.reply(
          ephemeral("❌ Kamu tidak memiliki akses untuk menutup order ini.")
        );
      }

      if (!activeOrder(order)) {
        return interaction.reply(
          ephemeral("❌ Order sudah ditutup sebelumnya.")
        );
      }

      order.status = "CANCELLED";
      order.cancelledAt = Date.now();

      if (isStaff(interaction)) {
        order.staffId = interaction.user.id;
      }

      await persistOrder(interaction.guild, order);

      await interaction.reply(
        "🔒 Order dibatalkan. Channel akan ditutup dalam 5 detik."
      );

      setTimeout(async () => {
        await interaction.channel
          ?.delete(`EntongStore order ${orderId} closed`)
          .catch(() => {});
      }, 5000);

      return;
    }
  } catch (error) {
    console.error("❌ INTERACTION ERROR:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        ephemeral("❌ Terjadi kesalahan. Silakan hubungi staff EntongStore.")
      ).catch(() => {});
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(
        "❌ Terjadi kesalahan. Silakan hubungi staff EntongStore."
      ).catch(() => {});
    }
  }
});

// ======================================================
// LOGIN
// ======================================================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN tidak ditemukan!");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("❌ Gagal login ke Discord:", error);
  process.exit(1);
});
