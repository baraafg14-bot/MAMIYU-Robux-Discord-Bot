
require("dotenv").config();

const fs = require("fs");
const path = require("path");

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
  AttachmentBuilder
} = require("discord.js");

const config = require("./config.json");

const QRIS_FILE = path.join(
  __dirname,
  "qris-entongstore.jpg"
);

const ORDER_FILE = path.join(__dirname, "orders.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let orders = {};

try {
  if (fs.existsSync(ORDER_FILE)) {
    orders = JSON.parse(
      fs.readFileSync(ORDER_FILE, "utf8")
    );
  }
} catch (error) {
  console.error("Gagal membaca orders.json:", error.message);
}

function saveOrders() {
  fs.writeFileSync(
    ORDER_FILE,
    JSON.stringify(orders, null, 2)
  );
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value) || 0
  );
}

function makeId() {
  return "ETS-" + Date.now().toString(36).toUpperCase();
}

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.brandColor || "#168BFF")
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "ENTONGSTORE • TOP UP GAME"
    })
    .setTimestamp();
}

function isStaff(interaction) {
  if (
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return true;
  }

  return Boolean(
    config.roles?.staff &&
    interaction.member?.roles?.cache?.has(
      config.roles.staff
    )
  );
}

function statusText(status) {
  const labels = {
    WAITING_PAYMENT: "🟡 Menunggu pembayaran",
    PAYMENT_CHECKING: "🟠 Menunggu verifikasi staff",
    VERIFIED: "🔵 Pembayaran terverifikasi",
    PROCESSING: "🟣 Sedang diproses",
    COMPLETED: "🟢 Selesai",
    CANCELLED: "⚫ Dibatalkan",
    REJECTED: "🔴 Pembayaran ditolak"
  };

  return labels[status] || status;
}

function orderEmbed(order) {
  return makeEmbed(
    `📦 ORDER ${order.id}`,
    [
      `**Status:** ${statusText(order.status)}`,
      `**Pembeli:** <@${order.userId}>`,
      `**Username Roblox:** ${order.roblox}`,
      `**Paket:** ${rupiah(order.amount)} Robux`,
      `**Total:** Rp ${rupiah(order.price)}`,
      "**Pembayaran:** QRIS",
      `**Catatan:** ${order.notes || "-"}`,
      "",
      "⚠️ Jangan pernah meminta password Roblox."
    ].join("\n")
  );
}

function customerButtons(order) {
  const row = new ActionRowBuilder();

  if (order.status === "WAITING_PAYMENT") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ets_paid:${order.id}`)
        .setLabel("Sudah Bayar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`ets_cancel:${order.id}`)
        .setLabel("Batalkan")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return row.components.length ? [row] : [];
}

function staffButtons(order) {
  const row = new ActionRowBuilder();

  if (order.status === "PAYMENT_CHECKING") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ets_verify:${order.id}`)
        .setLabel("Verifikasi Pembayaran")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`ets_reject:${order.id}`)
        .setLabel("Tolak Pembayaran")
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (order.status === "VERIFIED") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ets_process:${order.id}`)
        .setLabel("Mulai Proses")
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (order.status === "PROCESSING") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ets_complete:${order.id}`)
        .setLabel("Selesaikan Order")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row.components.length ? [row] : [];
}

function allButtons(order) {
  return [
    ...customerButtons(order),
    ...staffButtons(order)
  ];
}

function amountRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ets_amount")
      .setPlaceholder("Pilih paket Robux")
      .addOptions(
        Object.entries(config.prices).map(
          ([amount, price]) => ({
            label: `${rupiah(amount)} Robux`,
            description: `Rp ${rupiah(price)}`,
            value: amount
          })
        )
      )
  );
}

async function fetchChannel(guild, id) {
  if (!id) return null;

  return guild.channels.fetch(id).catch(() => null);
}

async function updateOrder(guild, order, actorId) {
  order.updatedAt = new Date().toISOString();
  saveOrders();

  // Update pesan utama pada channel order.
  const orderChannel = await fetchChannel(
    guild,
    order.channelId
  );

  if (orderChannel && order.messageId) {
    const orderMessage = await orderChannel.messages
      .fetch(order.messageId)
      .catch(() => null);

    if (orderMessage) {
      await orderMessage.edit({
        embeds: [orderEmbed(order)],
        components: allButtons(order)
      }).catch(console.error);
    }
  }

  // Satu pesan log per order.
  const logChannel = await fetchChannel(
    guild,
    config.channels?.orderLogs
  );

  if (!logChannel || !logChannel.isTextBased()) {
    console.error("Channel order logs tidak ditemukan.");
    return;
  }

  const embed = orderEmbed(order).addFields({
    name: "Perubahan terakhir oleh",
    value: actorId ? `<@${actorId}>` : "Sistem"
  });

  let logMessage = null;

  if (order.logMessageId) {
    logMessage = await logChannel.messages
      .fetch(order.logMessageId)
      .catch(() => null);
  }

  if (logMessage) {
    await logMessage.edit({
      embeds: [embed]
    }).catch(console.error);
  } else {
    logMessage = await logChannel.send({
      embeds: [embed]
    });

    order.logMessageId = logMessage.id;
    saveOrders();
  }
}

async function createTextChannel(
  guild,
  name,
  parent,
  overwrites
) {
  let channel = guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildText &&
      c.name === name
  );

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: overwrites
    });
  }

  return channel;
}

async function setupServer(interaction) {
  await interaction.deferReply({
    ephemeral: true
  });

  const guild = interaction.guild;
  const everyone = guild.roles.everyone;

  let staffRole = config.roles?.staff
    ? await guild.roles
        .fetch(config.roles.staff)
        .catch(() => null)
    : null;

  if (!staffRole) {
    staffRole = await guild.roles.create({
      name: "ENTONGSTORE STAFF",
      color: config.brandColor || "#168BFF",
      reason: "Setup bot ENTONGSTORE"
    });

    config.roles = {
      ...(config.roles || {}),
      staff: staffRole.id
    };
  }

  async function getCategory(name, privateCategory = false) {
    let category = guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildCategory &&
        c.name === name
    );

    if (!category) {
      category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        ...(privateCategory
          ? {
              permissionOverwrites: [
                {
                  id: everyone.id,
                  deny: [
                    PermissionFlagsBits.ViewChannel
                  ]
                },
                {
                  id: staffRole.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory
                  ]
                }
              ]
            }
          : {})
      });
    }

    return category;
  }

  const infoCategory = await getCategory("INFORMASI");
  const storeCategory = await getCategory("ENTONGSTORE");
  const orderCategory = await getCategory(
    "ENTONGSTORE ORDERS"
  );
  const staffCategory = await getCategory(
    "STAFF",
    true
  );

  const everyonePublic = {
    id: everyone.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory
    ],
    deny: [
      PermissionFlagsBits.SendMessages
    ]
  };

  const botPermissions = {
    id: client.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ManageChannels
    ]
  };

  const publicPermissions = [
    everyonePublic,
    botPermissions
  ];

  const infoChannel = await createTextChannel(
    guild,
    "informasi",
    infoCategory,
    publicPermissions
  );

  const priceChannel = await createTextChannel(
    guild,
    "pricelist-robux",
    infoCategory,
    publicPermissions
  );

  const buyChannel = await createTextChannel(
    guild,
    "buy-robux",
    storeCategory,
    publicPermissions
  );

  const logsChannel = await createTextChannel(
    guild,
    "order-logs",
    staffCategory,
    [
      {
        id: everyone.id,
        deny: [
          PermissionFlagsBits.ViewChannel
        ]
      },
      {
        id: staffRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      botPermissions
    ]
  );

  config.channels = {
    info: infoChannel.id,
    prices: priceChannel.id,
    buy: buyChannel.id,
    orderLogs: logsChannel.id,
    ordersCategory: orderCategory.id
  };

  fs.writeFileSync(
    path.join(__dirname, "config.json"),
    JSON.stringify(config, null, 2)
  );

  const priceList = Object.entries(config.prices)
    .map(
      ([amount, price]) =>
        `> 💎 **${rupiah(amount)} Robux** — Rp ${rupiah(price)}`
    )
    .join("\n");

  const infoEmbed = makeEmbed(
    "❄️ SELAMAT DATANG DI ENTONGSTORE",
    [
      "⚡ TOP UP • GAME • ROBUX",
      "",
      "🛒 Pilih paket melalui BUY ROBUX.",
      "💳 Pembayaran hanya menggunakan QRIS.",
      "🛡️ Pembayaran diverifikasi staff secara manual.",
      "🔐 Jangan pernah membagikan password Roblox."
    ].join("\n")
  );

  const pricesEmbed = makeEmbed(
    "💎 PRICELIST ROBUX",
    priceList
  );

  const panelEmbed = makeEmbed(
    "🛒 ENTONGSTORE | BUY ROBUX",
    [
      "Selamat datang di layanan order ENTONGSTORE!",
      "",
      "1️⃣ Tekan tombol BUY ROBUX.",
      "2️⃣ Pilih paket Robux.",
      "3️⃣ Isi username Roblox.",
      "4️⃣ Scan QRIS di channel order privat.",
      "5️⃣ Kirim bukti pembayaran.",
      "6️⃣ Tunggu verifikasi staff.",
      "",
      "⚠️ Pastikan nominal pembayaran benar.",
      "Pembayaran hanya dianggap sah setelah diperiksa staff."
    ].join("\n")
  );

  await infoChannel.send({
    embeds: [infoEmbed]
  });

  await priceChannel.send({
    embeds: [pricesEmbed]
  });

  const recentMessages = await buyChannel.messages.fetch({
    limit: 50
  });

  const panelExists = recentMessages.some(
    message =>
      message.author.id === client.user.id &&
      message.embeds.some(
        embed =>
          embed.title === "ENTONGSTORE | BUY ROBUX"
      )
  );

  if (!panelExists) {
    await buyChannel.send({
      embeds: [panelEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ets_buy")
            .setLabel("BUY ROBUX")
            .setEmoji("🛒")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  await interaction.editReply({
    content: [
      "✅ **Setup ENTONGSTORE berhasil!**",
      `📢 Panel: <#${buyChannel.id}>`,
      `💎 Pricelist: <#${priceChannel.id}>`,
      `📋 Order logs: <#${logsChannel.id}>`,
      `🛡️ Role staff: <@&${staffRole.id}>`
    ].join("\n")
  });
}

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.guild) return;

    // Slash commands.
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply({
            content: "Khusus administrator.",
            ephemeral: true
          });
        }

        return setupServer(interaction);
      }

      if (interaction.commandName === "price") {
        const list = Object.entries(config.prices)
          .map(
            ([amount, price]) =>
              `💎 **${rupiah(amount)} Robux** — Rp ${rupiah(price)}`
          )
          .join("\n");

        return interaction.reply({
          embeds: [
            makeEmbed("💎 PRICELIST ENTONGSTORE", list)
          ],
          ephemeral: true
        });
      }

      if (interaction.commandName === "buy") {
        return interaction.reply({
          content: "Silakan pilih paket Robux:",
          components: [amountRow()],
          ephemeral: true
        });
      }
    }

    // Tombol panel BUY ROBUX.
    if (
      interaction.isButton() &&
      interaction.customId === "ets_buy"
    ) {
      return interaction.reply({
        content: "Silakan pilih paket Robux:",
        components: [amountRow()],
        ephemeral: true
      });
    }

    // Pemilihan paket.
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ets_amount"
    ) {
      const amount = interaction.values[0];

      if (!Object.hasOwn(config.prices, amount)) {
        return interaction.reply({
          content: "Paket tidak valid.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`ets_order:${amount}`)
        .setTitle("ENTONGSTORE • Order");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox")
            .setLabel("Username Roblox")
            .setPlaceholder("Username saja, jangan password")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(30)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("notes")
            .setLabel("Catatan (opsional)")
            .setPlaceholder("Catatan tambahan untuk staff")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(300)
        )
      );

      return interaction.showModal(modal);
    }

    // Membuat order baru.
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ets_order:")
    ) {
      const amount = interaction.customId.split(":")[1];
      const price = config.prices[amount];

      if (!price) {
        return interaction.reply({
          content: "Paket tidak valid.",
          ephemeral: true
        });
      }

      const activeOrder = Object.values(orders).find(
        order =>
          order.userId === interaction.user.id &&
          ![
            "COMPLETED",
            "CANCELLED",
            "REJECTED"
          ].includes(order.status)
      );

      if (activeOrder) {
        return interaction.reply({
          content:
            `Kamu masih memiliki order aktif: ` +
            `<#${activeOrder.channelId}>`,
          ephemeral: true
        });
      }

      const category = await fetchChannel(
        interaction.guild,
        config.channels?.ordersCategory
      );

      if (!category) {
        return interaction.reply({
          content: "Jalankan /setup terlebih dahulu.",
          ephemeral: true
        });
      }

      if (!fs.existsSync(QRIS_FILE)) {
        return interaction.reply({
          content:
            "File qris-entongstore.jpg tidak ditemukan. " +
            "Unggah file tersebut ke folder utama repository.",
          ephemeral: true
        });
      }

      await interaction.deferReply({
        ephemeral: true
      });

      const order = {
        id: makeId(),
        userId: interaction.user.id,
        roblox: interaction.fields
          .getTextInputValue("roblox")
          .trim(),
        notes:
          interaction.fields.getTextInputValue("notes") || "-",
        amount: Number(amount),
        price: Number(price),
        status: "WAITING_PAYMENT",
        channelId: null,
        messageId: null,
        logMessageId: null,
        createdAt: new Date().toISOString()
      };

      const safeUsername = interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 12) || "pembeli";

      const channel = await interaction.guild.channels.create({
        name:
          `order-${safeUsername}-` +
          order.id.slice(-5).toLowerCase(),
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [
              PermissionFlagsBits.ViewChannel
            ]
          },
          {
            id: order.userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: config.roles.staff,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      order.channelId = channel.id;
      orders[order.id] = order;
      saveOrders();

      const qrEmbed = orderEmbed(order)
        .setDescription(
          [
            `**ID Order:** ${order.id}`,
            `**Paket:** ${rupiah(order.amount)} Robux`,
            `**Total pembayaran:** Rp ${rupiah(order.price)}`,
            `**Username Roblox:** ${order.roblox}`,
            "",
            "## 💳 PEMBAYARAN QRIS",
            config.paymentInstructions ||
              "Scan QRIS dan bayar sesuai nominal.",
            "",
            "1. Scan QRIS di bawah.",
            "2. Periksa nominal sebelum membayar.",
            "3. Kirim foto bukti transaksi di channel ini.",
            "4. Tekan tombol **Sudah Bayar**.",
            "",
            "Pembayaran harus diverifikasi staff secara manual."
          ].join("\n")
        )
        .setImage("attachment://qris-entongstore.jpg");

      const message = await channel.send({
        content: `<@${order.userId}>`,
        embeds: [qrEmbed],
        files: [
          new AttachmentBuilder(QRIS_FILE, {
            name: "qris-entongstore.jpg"
          })
        ],
        components: allButtons(order)
      });

      order.messageId = message.id;
      saveOrders();

      await updateOrder(
        interaction.guild,
        order,
        interaction.user.id
      );

      return interaction.editReply({
        content:
          `✅ Order berhasil dibuat!\n` +
          `ID: **${order.id}**\n` +
          `Channel: <#${channel.id}>`
      });
    }

    if (!interaction.isButton()) return;

    const [action, id] = interaction.customId.split(":");

    if (!action.startsWith("ets_") || !id) return;

    const order = orders[id];

    if (!order) {
      return interaction.reply({
        content: "Order tidak ditemukan.",
        ephemeral: true
      });
    }

    if (order.channelId !== interaction.channelId) {
      return interaction.reply({
        content: "Tombol ini bukan untuk channel order tersebut.",
        ephemeral: true
      });
    }

    // Pembeli memberi tahu bahwa pembayaran sudah dilakukan.
    if (action === "ets_paid") {
      if (interaction.user.id !== order.userId) {
        return interaction.reply({
          content: "Hanya pemilik order yang dapat melakukan ini.",
          ephemeral: true
        });
      }

      if (order.status !== "WAITING_PAYMENT") {
        return interaction.reply({
          content: "Status pembayaran sudah berubah.",
          ephemeral: true
        });
      }

      order.status = "PAYMENT_CHECKING";

      await interaction.reply({
        content:
          "Bukti pembayaran sedang menunggu pemeriksaan staff.",
        ephemeral: true
      });

      await updateOrder(
        interaction.guild,
        order,
        interaction.user.id
      );

      if (config.roles?.staff) {
        await interaction.channel.send(
          `🔔 <@&${config.roles.staff}> ` +
          `Periksa pembayaran order **${order.id}**.`
        );
      }

      return;
    }

    // Membatalkan order.
    if (action === "ets_cancel") {
      if (
        interaction.user.id !== order.userId &&
        !isStaff(interaction)
      ) {
        return interaction.reply({
          content: "Kamu tidak memiliki akses.",
          ephemeral: true
        });
      }

      if (
        !["WAITING_PAYMENT", "PAYMENT_CHECKING"].includes(
          order.status
        )
      ) {
        return interaction.reply({
          content: "Order tidak bisa dibatalkan pada status ini.",
          ephemeral: true
        });
      }

      order.status = "CANCELLED";

      await interaction.reply({
        content: "Order berhasil dibatalkan.",
        ephemeral: true
      });

      await updateOrder(
        interaction.guild,
        order,
        interaction.user.id
      );

      return;
    }

    // Aksi yang hanya boleh dilakukan staff.
    const staffActions = {
      ets_verify: ["PAYMENT_CHECKING", "VERIFIED"],
      ets_reject: ["PAYMENT_CHECKING", "REJECTED"],
      ets_process: ["VERIFIED", "PROCESSING"],
      ets_complete: ["PROCESSING", "COMPLETED"]
    };

    if (staffActions[action]) {
      if (!isStaff(interaction)) {
        return interaction.reply({
          content: "Khusus staff ENTONGSTORE.",
          ephemeral: true
        });
      }

      const [expectedStatus, nextStatus] =
        staffActions[action];

      if (order.status !== expectedStatus) {
        return interaction.reply({
          content: "Status order sudah berubah.",
          ephemeral: true
        });
      }

      if (action === "ets_verify") {
        order.verifiedBy = interaction.user.id;
        order.verifiedAt = new Date().toISOString();
      }

      order.status = nextStatus;

      await interaction.reply({
        content: `Status diperbarui: ${statusText(nextStatus)}`,
        ephemeral: true
      });

      await updateOrder(
        interaction.guild,
        order,
        interaction.user.id
      );

      return;
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "Terjadi kesalahan. Periksa log hosting untuk detailnya.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// Otomatis mendeteksi bukti transaksi berupa lampiran.
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const order = Object.values(orders).find(
    item => item.channelId === message.channel.id
  );

  if (!order || message.author.id !== order.userId) return;
  if (!message.attachments.size) return;

  if (
    !["WAITING_PAYMENT", "PAYMENT_CHECKING"].includes(
      order.status
    )
  ) {
    return;
  }

  if (order.status === "WAITING_PAYMENT") {
    order.status = "PAYMENT_CHECKING";
  }

  await updateOrder(
    message.guild,
    order,
    message.author.id
  );

  await message.channel.send(
    `📎 Lampiran bukti transaksi diterima untuk **${order.id}**. ` +
    "Staff harus memeriksa transaksi asli sebelum memverifikasi."
  );

  if (config.roles?.staff) {
    await message.channel.send(
      `🔔 <@&${config.roles.staff}> ` +
      `Silakan periksa order **${order.id}**.`
    );
  }
});

client.once("ready", () => {
  console.log(
    `✅ ${config.storeName} online sebagai ${client.user.tag}`
  );

  client.user.setActivity(
    "ENTONGSTORE | BUY ROBUX"
  );
});

client.on("error", error => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled rejection:", error);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN belum diisi di .env");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
