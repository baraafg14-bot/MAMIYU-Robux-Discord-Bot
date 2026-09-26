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
  TextInputStyle,
  MessageFlags,
  Events
} = require("discord.js");

const fs = require("fs");

// ======================================================
// CONFIG
// ======================================================

const CONFIG_FILE = "./config.json";

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("❌ config.json tidak ditemukan!");
  process.exit(1);
}

const config = JSON.parse(
  fs.readFileSync(CONFIG_FILE, "utf8")
);

config.roles = config.roles || {};
config.channels = config.channels || {};

config.prices = config.prices || {
  "10": 2000,
  "25": 4000,
  "50": 8000,
  "100": 16000,
  "200": 32000,
  "300": 48000,
  "400": 64000,
  "500": 80000,
  "600": 96000,
  "700": 112000,
  "800": 128000,
  "900": 144000,
  "1000": 160000
};

config.paymentMethods = config.paymentMethods || [
  "OVO",
  "GOPAY",
  "DANA",
  "BANK TRANSFER"
];

config.paymentAccounts = config.paymentAccounts || {
  "OVO": "Belum diatur",
  "GOPAY": "Belum diatur",
  "DANA": "Belum diatur",
  "BANK TRANSFER": "Belum diatur"
};

// ======================================================
// ORDER DATABASE
// ======================================================

const ORDERS_FILE = "./orders.json";

let orders = {};

if (fs.existsSync(ORDERS_FILE)) {
  try {
    orders = JSON.parse(
      fs.readFileSync(ORDERS_FILE, "utf8")
    );
  } catch {
    orders = {};
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
// UTILITY
// ======================================================

function money(number) {
  return new Intl.NumberFormat("id-ID").format(
    Number(number)
  );
}

function makeOrderId() {
  return (
    "RBX-" +
    Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase() +
    "-" +
    Date.now()
      .toString()
      .slice(-4)
  );
}

function isStaff(interaction) {
  const roleId = config.roles.staff;

  if (!roleId) return false;

  return interaction.member?.roles?.cache?.has(roleId) || false;
}

function ephemeral(content) {
  return {
    content,
    flags: MessageFlags.Ephemeral
  };
}

// ======================================================
// SAVE CONFIG
// ======================================================

function saveConfig() {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

// ======================================================
// GET / CREATE STAFF ROLE
// ======================================================

async function getStaffRole(guild) {
  let staffRole = null;

  // 1. Coba gunakan ID yang tersimpan
  if (config.roles.staff) {
    staffRole = await guild.roles
      .fetch(config.roles.staff)
      .catch(() => null);
  }

  // 2. Kalau ID rusak, cari berdasarkan nama
  if (!staffRole) {
    staffRole = guild.roles.cache.find(
      role => role.name === "MAMIYU STAFF"
    );
  }

  // 3. Kalau belum ada, buat baru
  if (!staffRole) {
    staffRole = await guild.roles.create({
      name: "MAMIYU STAFF",
      color: 0x8b2cff,
      reason: "MAMIYU Store Staff Role"
    });
  }

  // 4. Simpan ID yang benar
  config.roles.staff = staffRole.id;
  saveConfig();

  return staffRole;
}

// ======================================================
// GET CHANNEL
// ======================================================

async function getChannel(guild, channelId) {
  if (!channelId) return null;

  return guild.channels
    .fetch(channelId)
    .catch(() => null);
}

// ======================================================
// ORDER LOG
// ======================================================

async function createOrderLog(guild, order) {
  const logChannel = await getChannel(
    guild,
    config.channels.orderLogs
  );

  if (!logChannel) return null;

  const embed = new EmbedBuilder()
    .setTitle("🛒 ORDER #" + order.id)
    .setColor(0x8b2cff)
    .addFields(
      {
        name: "👤 Customer",
        value: `<@${order.userId}>`,
        inline: true
      },
      {
        name: "🎮 Roblox",
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
        name: "💳 Pembayaran",
        value: order.paymentMethod || "Belum dipilih",
        inline: true
      },
      {
        name: "📌 Status",
        value: "🟡 WAITING PAYMENT",
        inline: true
      }
    )
    .setFooter({
      text: "MAMIYU STORE • Auto Order System"
    })
    .setTimestamp();

  const message = await logChannel
    .send({
      embeds: [embed]
    })
    .catch(() => null);

  if (message) {
    order.logMessageId = message.id;
    saveOrders();
  }

  return message;
}

// ======================================================
// UPDATE ORDER LOG
// ======================================================

async function updateOrderLog(guild, order) {
  if (!order.logMessageId) {
    return createOrderLog(guild, order);
  }

  const logChannel = await getChannel(
    guild,
    config.channels.orderLogs
  );

  if (!logChannel) return;

  const message = await logChannel.messages
    .fetch(order.logMessageId)
    .catch(() => null);

  if (!message) {
    return createOrderLog(guild, order);
  }

  let statusText = "🟡 WAITING PAYMENT";
  let color = 0x8b2cff;

  if (order.status === "PAYMENT_CLAIMED") {
    statusText = "🟠 PAYMENT CLAIMED";
    color = 0xffa500;
  }

  if (order.status === "VERIFIED") {
    statusText = "🟢 PAYMENT VERIFIED";
    color = 0x00c853;
  }

  if (order.status === "COMPLETED") {
    statusText = "🎉 COMPLETED";
    color = 0x00c853;
  }

  if (order.status === "CANCELLED") {
    statusText = "🔴 CANCELLED";
    color = 0xff0000;
  }

  const embed = new EmbedBuilder()
    .setTitle("🛒 ORDER #" + order.id)
    .setColor(color)
    .addFields(
      {
        name: "👤 Customer",
        value: `<@${order.userId}>`,
        inline: true
      },
      {
        name: "🎮 Roblox",
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
        name: "💳 Pembayaran",
        value: order.paymentMethod || "Belum dipilih",
        inline: true
      },
      {
        name: "📌 Status",
        value: statusText,
        inline: true
      }
    );

  if (order.staffId) {
    embed.addFields({
      name: "👨‍💼 Staff",
      value: `<@${order.staffId}>`,
      inline: true
    });
  }

  embed
    .setFooter({
      text: "MAMIYU STORE • Auto Order System"
    })
    .setTimestamp();

  await message.edit({
    embeds: [embed]
  }).catch(() => {});
}

// ======================================================
// READY
// ======================================================

client.once(Events.ClientReady, async () => {
  console.log(
    `✅ MAMIYU BOT ONLINE sebagai ${client.user.tag}`
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
    // SLASH COMMAND
    // ==================================================

    if (interaction.isChatInputCommand()) {

      // ================================================
      // SETUP
      // ================================================

      if (interaction.commandName === "setup") {

        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply(
            ephemeral(
              "❌ Hanya administrator yang dapat menjalankan setup."
            )
          );
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const guild = interaction.guild;

        // STAFF ROLE
        const staffRole = await getStaffRole(guild);

        // ==============================================
        // CATEGORY
        // ==============================================

        async function findCategory(name) {
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

        async function findText(name, parent) {
          let channel = guild.channels.cache.find(
            c =>
              c.type === ChannelType.GuildText &&
              c.name === name
          );

          if (!channel) {
            channel = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent
            });
          }

          return channel;
        }

        const information = await findCategory(
          "📌 INFORMATION"
        );

        const store = await findCategory(
          "🛒 ROBUX STORE"
        );

        const ordersCategory = await findCategory(
          "🎫 ORDERS"
        );

        const staffCategory = await findCategory(
          "🔐 STAFF"
        );

        const announcement = await findText(
          "📢・announcement",
          information
        );

        const rules = await findText(
          "📜・rules",
          information
        );

        const priceList = await findText(
          "💰・price-list",
          information
        );

        const createOrder = await findText(
          "🛍️・create-order",
          store
        );

        const testimonials = await findText(
          "⭐・testimonials",
          store
        );

        const orderLogs = await findText(
          "📋・order-logs",
          staffCategory
        );

        const paymentLogs = await findText(
          "💳・payment-logs",
          staffCategory
        );

        const staffChat = await findText(
          "🛠️・staff-chat",
          staffCategory
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

        // ==============================================
        // PRICE LIST
        // ==============================================

        const priceLines = Object.entries(
          config.prices
        )
          .map(
            ([amount, price]) =>
              `**${money(amount)} RBX** → **Rp ${money(price)}**`
          )
          .join("\n");

        const priceEmbed = new EmbedBuilder()
          .setTitle(
            "💜 MAMIYU STORE — PRICE LIST"
          )
          .setDescription(priceLines)
          .setColor(0x8b2cff)
          .setFooter({
            text: "Via Username • MAMIYU STORE"
          });

        await priceList
          .send({
            embeds: [priceEmbed]
          })
          .catch(() => {});

        // ==============================================
        // BUY BUTTON
        // ==============================================

        const buyEmbed = new EmbedBuilder()
          .setTitle(
            "🛒 MAMIYU ROBUX STORE"
          )
          .setDescription(
            "Butuh Robux?\n\n" +
            "⚡ Proses cepat\n" +
            "🔒 Aman\n" +
            "💜 Pelayanan ramah\n\n" +
            "Klik **BUY ROBUX** untuk membuat order."
          )
          .setColor(0x8b2cff);

        const buyButton =
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("buy_robux")
              .setLabel("BUY ROBUX")
              .setEmoji("🛒")
              .setStyle(ButtonStyle.Primary)
          );

        await createOrder
          .send({
            embeds: [buyEmbed],
            components: [buyButton]
          })
          .catch(() => {});

        return interaction.editReply(
          "✅ Setup MAMIYU Store selesai.\n\n" +
          `👨‍💼 Staff Role: <@&${staffRole.id}>\n` +
          "🛒 Sistem order siap digunakan."
        );
      }

      // ================================================
      // PRICE
      // ================================================

      if (interaction.commandName === "price") {

        const lines = Object.entries(
          config.prices
        )
          .map(
            ([amount, price]) =>
              `**${money(amount)} RBX** → **Rp ${money(price)}**`
          )
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "💜 MAMIYU STORE — PRICE LIST"
              )
              .setDescription(lines)
              .setColor(0x8b2cff)
              .setFooter({
                text: "Via Username • MAMIYU STORE"
              })
          ]
        });
      }

      // ================================================
      // BUY
      // ================================================

      if (interaction.commandName === "buy") {

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId("robux_amount")
            .setPlaceholder(
              "Pilih nominal Robux..."
            )
            .addOptions(
              Object.entries(
                config.prices
              ).map(([amount, price]) => ({
                label: `${money(amount)} Robux`,
                description: `Rp ${money(price)}`,
                value: amount
              }))
            );

        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "💜 PILIH NOMINAL"
              )
              .setDescription(
                "Pilih jumlah Robux yang ingin kamu beli."
              )
              .setColor(0x8b2cff)
          ],
          components: [
            new ActionRowBuilder().addComponents(menu)
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

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId("robux_amount")
          .setPlaceholder(
            "Pilih nominal Robux..."
          )
          .addOptions(
            Object.entries(
              config.prices
            ).map(([amount, price]) => ({
              label: `${money(amount)} Robux`,
              description: `Rp ${money(price)}`,
              value: amount
            }))
          );

      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "💜 PILIH NOMINAL"
            )
            .setDescription(
              "Pilih jumlah Robux yang ingin kamu order."
            )
            .setColor(0x8b2cff)
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // ==================================================
    // SELECT ROBUX
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "robux_amount"
    ) {

      const amount = interaction.values[0];

      const modal =
        new ModalBuilder()
          .setCustomId(
            `order_modal_${amount}`
          )
          .setTitle(
            "MAMIYU • DATA ORDER"
          );

      const username =
        new TextInputBuilder()
          .setCustomId(
            "roblox_username"
          )
          .setLabel(
            "Username Roblox"
          )
          .setPlaceholder(
            "Masukkan username Roblox"
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true)
          .setMaxLength(30);

      const notes =
        new TextInputBuilder()
          .setCustomId("notes")
          .setLabel(
            "Catatan (opsional)"
          )
          .setPlaceholder(
            "Contoh: proses secepatnya"
          )
          .setStyle(
            TextInputStyle.Paragraph
          )
          .setRequired(false)
          .setMaxLength(300);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          username
        ),
        new ActionRowBuilder().addComponents(
          notes
        )
      );

      return interaction.showModal(modal);
    }

    // ==================================================
    // MODAL ORDER
    // ==================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith(
        "order_modal_"
      )
    ) {

      const amount =
        interaction.customId.replace(
          "order_modal_",
          ""
        );

      const username =
        interaction.fields.getTextInputValue(
          "roblox_username"
        );

      const notes =
        interaction.fields.getTextInputValue(
          "notes"
        ) || "-";

      const price =
        config.prices[amount];

      if (!price) {
        return interaction.reply(
          ephemeral(
            "❌ Nominal Robux tidak ditemukan."
          )
        );
      }

      const guild = interaction.guild;

      // ==============================================
      // STAFF ROLE
      // ==============================================

      const staffRole =
        await getStaffRole(guild);

      // ==============================================
      // ORDER CATEGORY
      // ==============================================

      const category =
        await getChannel(
          guild,
          config.channels.ordersCategory
        );

      if (
        !category ||
        category.type !== ChannelType.GuildCategory
      ) {
        return interaction.reply(
          ephemeral(
            "❌ Category order tidak ditemukan. Jalankan `/setup` lagi."
          )
        );
      }

      // ==============================================
      // ORDER ID
      // ==============================================

      const orderId =
        makeOrderId();

      // ==============================================
      // CREATE CHANNEL
      // ==============================================

      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
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
      ];

      const channel =
        await guild.channels.create({
          name:
            `order-${orderId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites
        });

      // ==============================================
      // SAVE ORDER
      // ==============================================

      const order = {
        id: orderId,
        userId: interaction.user.id,
        username,
        amount: Number(amount),
        price,
        notes,
        paymentMethod: null,
        status: "WAITING_PAYMENT",
        staffId: null,
        channelId: channel.id,
        logMessageId: null,
        createdAt: Date.now()
      };

      orders[orderId] = order;

      saveOrders();

      // ==============================================
      // PAYMENT BUTTONS
      // ==============================================

      const paymentButtons =
        new ActionRowBuilder();

      for (
        const [index, method] of
        config.paymentMethods.entries()
      ) {

        paymentButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `pay_${orderId}_${index}`
            )
            .setLabel(method)
            .setStyle(
              index === 0
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
        );
      }

      // ==============================================
      // ORDER EMBED
      // ==============================================

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🛒 ORDER ${orderId}`
          )
          .setDescription(
            "Silakan pilih metode pembayaran di bawah."
          )
          .addFields(
            {
              name: "👤 Customer",
              value:
                `<@${interaction.user.id}>`,
              inline: false
            },
            {
              name: "🎮 Roblox Username",
              value:
                `\`${username}\``,
              inline: false
            },
            {
              name: "💎 Product",
              value:
                `**${money(amount)} Robux**`,
              inline: true
            },
            {
              name: "💰 Total",
              value:
                `**Rp ${money(price)}**`,
              inline: true
            },
            {
              name: "📝 Catatan",
              value: notes,
              inline: false
            },
            {
              name: "📌 Status",
              value:
                "🟡 WAITING PAYMENT",
              inline: false
            }
          )
          .setColor(0x8b2cff)
          .setFooter({
            text:
              "MAMIYU STORE • Jangan kirim password Roblox kepada siapa pun."
          });

      await channel.send({
        content:
          `<@${interaction.user.id}> <@&${staffRole.id}>`,
        embeds: [embed],
        components: [paymentButtons]
      });

      // ==============================================
      // ORDER LOG
      // ==============================================

      await createOrderLog(
        guild,
        order
      );

      return interaction.reply(
        ephemeral(
          `✅ Order berhasil dibuat!\n\n` +
          `🆔 **${orderId}**\n` +
          `📦 **${amount} Robux**\n` +
          `💰 **Rp ${money(price)}**\n\n` +
          `👉 <#${channel.id}>`
        )
      );
    }

    // ==================================================
    // PAYMENT METHOD
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pay_")
    ) {

      const parts =
        interaction.customId.split("_");

      const orderId = parts[1];

      const methodIndex =
        Number(parts[2]);

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Data order tidak ditemukan."
          )
        );
      }

      const method =
        config.paymentMethods[
          methodIndex
        ];

      if (!method) {
        return interaction.reply(
          ephemeral(
            "❌ Metode pembayaran tidak ditemukan."
          )
        );
      }

      order.paymentMethod = method;

      saveOrders();

      const account =
        config.paymentAccounts[method] ||
        "Belum diatur oleh admin.";

      const buttons =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(
              `paid_${orderId}`
            )
            .setLabel(
              "SAYA SUDAH BAYAR"
            )
            .setEmoji("✅")
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              `close_${orderId}`
            )
            .setLabel(
              "CANCEL ORDER"
            )
            .setEmoji("❌")
            .setStyle(
              ButtonStyle.Danger
            )
        );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `💳 PEMBAYARAN • ${method}`
            )
            .setDescription(
              `Silakan lakukan pembayaran ke:\n\n` +
              `💰 **${account}**\n\n` +
              `Setelah membayar, kirim **bukti pembayaran** ` +
              `di channel order ini.\n\n` +
              `Kemudian tekan **SAYA SUDAH BAYAR**.`
            )
            .setColor(0x8b2cff)
        ],
        components: [buttons]
      });
    }

    // ==================================================
    // CUSTOMER CLAIM PAYMENT
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("paid_")
    ) {

      const orderId =
        interaction.customId.replace(
          "paid_",
          ""
        );

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Order tidak ditemukan."
          )
        );
      }

      // Hanya customer pemilik order
      if (
        interaction.user.id !==
        order.userId
      ) {
        return interaction.reply(
          ephemeral(
            "❌ Hanya pemilik order yang dapat menekan tombol ini."
          )
        );
      }

      order.status =
        "PAYMENT_CLAIMED";

      saveOrders();

      await updateOrderLog(
        interaction.guild,
        order
      );

      const staffRole =
        await getStaffRole(
          interaction.guild
        );

      const verifyButtons =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(
              `verify_${orderId}`
            )
            .setLabel(
              "VERIFIKASI PEMBAYARAN"
            )
            .setEmoji("🔎")
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              `cancel_${orderId}`
            )
            .setLabel(
              "TOLAK / BATAL"
            )
            .setEmoji("❌")
            .setStyle(
              ButtonStyle.Danger
            )
        );

      await interaction.channel.send({
        content:
          `🔔 <@&${staffRole.id}> **Pembayaran diklaim!**\n` +
          `Silakan cek bukti pembayaran customer sebelum melakukan verifikasi.`,
        components: [verifyButtons]
      });

      return interaction.reply(
        ephemeral(
          "✅ Pembayaran ditandai sudah dibayar.\n\n" +
          "Staff akan memeriksa bukti pembayaran kamu."
        )
      );
    }

    // ==================================================
    // VERIFY PAYMENT
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "verify_"
      )
    ) {

      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral(
            "❌ Hanya MAMIYU STAFF yang dapat memverifikasi pembayaran."
          )
        );
      }

      const orderId =
        interaction.customId.replace(
          "verify_",
          ""
        );

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Order tidak ditemukan."
          )
        );
      }

      if (
        order.status !==
        "PAYMENT_CLAIMED"
      ) {
        return interaction.reply(
          ephemeral(
            "❌ Order belum berstatus PAYMENT CLAIMED."
          )
        );
      }

      order.status =
        "VERIFIED";

      order.staffId =
        interaction.user.id;

      saveOrders();

      await updateOrderLog(
        interaction.guild,
        order
      );

      const completeButton =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `complete_${orderId}`
            )
            .setLabel(
              "SELESAIKAN ORDER"
            )
            .setEmoji("🎉")
            .setStyle(
              ButtonStyle.Success
            )
        );

      await interaction.channel.send({
        content:
          `🔎 **PEMBAYARAN TERVERIFIKASI**\n\n` +
          `Staff: <@${interaction.user.id}>\n` +
          `Order: **${orderId}**\n\n` +
          `Silakan proses pengiriman Robux.`,
        components: [completeButton]
      });

      return interaction.reply(
        ephemeral(
          "✅ Pembayaran berhasil diverifikasi."
        )
      );
    }

    // ==================================================
    // COMPLETE ORDER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "complete_"
      )
    ) {

      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral(
            "❌ Hanya MAMIYU STAFF yang dapat menyelesaikan order."
          )
        );
      }

      const orderId =
        interaction.customId.replace(
          "complete_",
          ""
        );

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Order tidak ditemukan."
          )
        );
      }

      if (
        order.status !==
        "VERIFIED"
      ) {
        return interaction.reply(
          ephemeral(
            "❌ Pembayaran belum diverifikasi."
          )
        );
      }

      order.status =
        "COMPLETED";

      order.staffId =
        interaction.user.id;

      order.completedAt =
        Date.now();

      saveOrders();

      await updateOrderLog(
        interaction.guild,
        order
      );

      await interaction.reply(
        `🎉 **ORDER SELESAI!**\n\n` +
        `🆔 ${orderId}\n` +
        `👤 <@${order.userId}>\n` +
        `💎 ${money(order.amount)} Robux\n\n` +
        `Staff: <@${interaction.user.id}>`
      );

      return;
    }

    // ==================================================
    // CANCEL ORDER STAFF
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "cancel_"
      )
    ) {

      if (!isStaff(interaction)) {
        return interaction.reply(
          ephemeral(
            "❌ Hanya MAMIYU STAFF yang dapat membatalkan order."
          )
        );
      }

      const orderId =
        interaction.customId.replace(
          "cancel_",
          ""
        );

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Order tidak ditemukan."
          )
        );
      }

      order.status =
        "CANCELLED";

      order.staffId =
        interaction.user.id;

      saveOrders();

      await updateOrderLog(
        interaction.guild,
        order
      );

      await interaction.reply(
        `🔴 **ORDER DIBATALKAN**\n\n` +
        `Order: **${orderId}**\n` +
        `Staff: <@${interaction.user.id}>`
      );

      return;
    }

    // ==================================================
    // CLOSE ORDER CUSTOMER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "close_"
      )
    ) {

      const orderId =
        interaction.customId.replace(
          "close_",
          ""
        );

      const order =
        orders[orderId];

      if (!order) {
        return interaction.reply(
          ephemeral(
            "❌ Order tidak ditemukan."
          )
        );
      }

      if (
        interaction.user.id !==
        order.userId &&
        !isStaff(interaction)
      ) {
        return interaction.reply(
          ephemeral(
            "❌ Kamu tidak memiliki akses ke order ini."
          )
        );
      }

      order.status =
        "CANCELLED";

      saveOrders();

      await updateOrderLog(
        interaction.guild,
        order
      );

      await interaction.reply(
        "🔒 Order akan ditutup dalam 5 detik."
      );

      setTimeout(async () => {
        await interaction.channel
          .delete(
            `Order ${orderId} closed`
          )
          .catch(() => {});
      }, 5000);

      return;
    }

  } catch (error) {

    console.error(
      "❌ INTERACTION ERROR:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply(
        ephemeral(
          "❌ Terjadi error pada bot. Staff silakan cek log Railway."
        )
      ).catch(() => {});
    }
  }
});

// ======================================================
// LOGIN
// ======================================================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN tidak ditemukan di Railway Variables!"
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
).catch(error => {
  console.error(
    "❌ Gagal login ke Discord:",
    error
  );
});
