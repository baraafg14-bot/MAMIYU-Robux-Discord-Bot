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

const config = JSON.parse(
  fs.readFileSync("./config.json", "utf8")
);

// ================================
// CLIENT
// ================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================================
// HELPER
// ================================

function money(number) {
  return new Intl.NumberFormat("id-ID").format(Number(number));
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
  return (
    member &&
    config.roles &&
    config.roles.staff &&
    member.roles.cache.has(config.roles.staff)
  );
}

async function sendLog(guild, title, description, color = 0x8b2cff) {
  try {
    const channelId = config.channels?.orderLogs;

    if (!channelId) return;

    const channel = await guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (!channel) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setTimestamp()
      ]
    });
  } catch (error) {
    console.error("Gagal mengirim log:", error);
  }
}

function getPrice(amount) {
  if (!config.prices) return null;

  return config.prices[amount];
}

// ================================
// READY
// ================================

client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`MAMIYU BOT ONLINE`);
  console.log(`Login sebagai: ${client.user.tag}`);
  console.log(`Bot ID: ${client.user.id}`);
  console.log("--------------------------------");
});

// ================================
// INTERACTION
// ================================

client.on("interactionCreate", async (interaction) => {
  try {

    // ==================================================
    // SLASH COMMAND
    // ==================================================

    if (interaction.isChatInputCommand()) {

      // ============================
      // /setup
      // ============================

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

        await interaction.deferReply({
          ephemeral: true
        });

        const guild = interaction.guild;

        // ============================
        // STAFF ROLE
        // ============================

        let staffRole = guild.roles.cache.find(
          role => role.name === "MAMIYU STAFF"
        );

        if (!staffRole) {
          staffRole = await guild.roles.create({
            name: "MAMIYU STAFF",
            color: 0x8b2cff,
            reason: "MAMIYU Store setup"
          });
        }

        config.roles.staff = staffRole.id;

        // ============================
        // CATEGORY
        // ============================

        async function findOrCreateCategory(name) {

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

        // ============================
        // TEXT CHANNEL
        // ============================

        async function findOrCreateText(
          name,
          parent,
          options = {}
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
              parent,
              ...options
            });
          }

          return channel;
        }

        // ============================
        // CREATE CATEGORIES
        // ============================

        const infoCategory =
          await findOrCreateCategory("📌 INFORMATION");

        const storeCategory =
          await findOrCreateCategory("🛒 ROBUX STORE");

        const ordersCategory =
          await findOrCreateCategory("🎫 ORDERS");

        const staffCategory =
          await findOrCreateCategory("🔐 STAFF");

        // ============================
        // CREATE CHANNELS
        // ============================

        const announcement =
          await findOrCreateText(
            "📢・announcement",
            infoCategory
          );

        const rules =
          await findOrCreateText(
            "📜・rules",
            infoCategory
          );

        const priceList =
          await findOrCreateText(
            "💰・price-list",
            infoCategory
          );

        const createOrder =
          await findOrCreateText(
            "🛍️・create-order",
            storeCategory
          );

        const testimonials =
          await findOrCreateText(
            "⭐・testimonials",
            storeCategory
          );

        const orderLogs =
          await findOrCreateText(
            "📋・order-logs",
            staffCategory
          );

        const paymentLogs =
          await findOrCreateText(
            "💳・payment-logs",
            staffCategory
          );

        const staffChat =
          await findOrCreateText(
            "🛠️・staff-chat",
            staffCategory
          );

        // ============================
        // SAVE CONFIG
        // ============================

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

        fs.writeFileSync(
          "./config.json",
          JSON.stringify(config, null, 2)
        );

        // ============================
        // PRICE EMBED
        // ============================

        const priceLines =
          Object.entries(config.prices || {})
            .map(
              ([robux, price]) =>
                `**${money(robux)} RBX** → **Rp ${money(price)}**`
            )
            .join("\n");

        const priceEmbed =
          new EmbedBuilder()
            .setTitle("💜 MAMIYU STORE — PRICE LIST")
            .setDescription(
              "Harga Robux via Username Roblox."
            )
            .addFields({
              name: "💎 DAFTAR HARGA",
              value: priceLines.slice(0, 1024)
            })
            .setColor(0x8b2cff)
            .setFooter({
              text: "MAMIYU STORE • Via Username"
            });

        await priceList.send({
          embeds: [priceEmbed]
        });

        // ============================
        // BUY BUTTON
        // ============================

        const buyEmbed =
          new EmbedBuilder()
            .setTitle("🛒 MAMIYU ROBUX STORE")
            .setDescription(
              "Butuh Robux?\n\n" +
              "⚡ Proses cepat\n" +
              "🔒 Aman & terpercaya\n" +
              "💜 Pelayanan ramah\n\n" +
              "Klik **BUY ROBUX** untuk membuat order."
            )
            .setColor(0x8b2cff);

        const buyButton =
          new ButtonBuilder()
            .setCustomId("buy_robux")
            .setLabel("BUY ROBUX")
            .setEmoji("🛒")
            .setStyle(ButtonStyle.Primary);

        await createOrder.send({
          embeds: [buyEmbed],
          components: [
            new ActionRowBuilder().addComponents(
              buyButton
            )
          ]
        });

        return interaction.editReply(
          "✅ Setup MAMIYU Store selesai."
        );
      }

      // ============================
      // /price
      // ============================

      if (interaction.commandName === "price") {

        const lines =
          Object.entries(config.prices || {})
            .map(
              ([robux, price]) =>
                `**${money(robux)} RBX** → **Rp ${money(price)}**`
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

      // ============================
      // /buy
      // ============================

      if (interaction.commandName === "buy") {
        return showAmountMenu(interaction);
      }
    }

    // ==================================================
    // BUY ROBUX BUTTON
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId === "buy_robux"
    ) {
      return showAmountMenu(interaction);
    }

    // ==================================================
    // NOMINAL ROBUX
    // ==================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "robux_amount"
    ) {

      const amount = interaction.values[0];

      const price = getPrice(amount);

      if (price === null || price === undefined) {
        return interaction.reply({
          content: "❌ Nominal Robux tidak ditemukan.",
          ephemeral: true
        });
      }

      const modal =
        new ModalBuilder()
          .setCustomId(`order_modal_${amount}`)
          .setTitle("MAMIYU • Data Order");

      const username =
        new TextInputBuilder()
          .setCustomId("roblox_username")
          .setLabel("Username Roblox")
          .setPlaceholder("Masukkan username Roblox")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30);

      const notes =
        new TextInputBuilder()
          .setCustomId("notes")
          .setLabel("Catatan (opsional)")
          .setPlaceholder("Contoh: proses secepatnya")
          .setStyle(TextInputStyle.Paragraph)
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
    // ORDER MODAL
    // ==================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("order_modal_")
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

      const price = getPrice(amount);

      if (price === null || price === undefined) {
        return interaction.reply({
          content: "❌ Harga produk tidak ditemukan.",
          ephemeral: true
        });
      }

      const orderId = makeId();

      const category =
        await interaction.guild.channels.fetch(
          config.channels?.ordersCategory
        ).catch(() => null);

      if (!category) {
        return interaction.reply({
          content:
            "❌ Category order tidak ditemukan. Jalankan `/setup`.",
          ephemeral: true
        });
      }

      // ============================
      // CREATE ORDER CHANNEL
      // ============================

      const channel =
        await interaction.guild.channels.create({
          name: `order-${orderId.toLowerCase()}`,
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
              id: interaction.user.id,
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
            }
          ]
        });

      // ============================
      // SAVE ORDER DATA IN TOPIC
      // ============================

      await channel.setTopic(
        JSON.stringify({
          orderId,
          customerId: interaction.user.id,
          username,
          amount,
          price,
          notes,
          status: "WAITING PAYMENT"
        })
      ).catch(() => {});

      // ============================
      // PAYMENT BUTTONS
      // ============================

      const paymentMethods =
        Array.isArray(config.paymentMethods)
          ? config.paymentMethods
          : [];

      const paymentButtons =
        paymentMethods.map((method, index) => {

          const safeMethod =
            String(method)
              .replace(/\s+/g, "_")
              .slice(0, 70);

          return new ButtonBuilder()
            .setCustomId(
              `pay_${orderId}_${safeMethod}`
            )
            .setLabel(String(method).slice(0, 80))
            .setStyle(
              index === 0
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            );
        });

      // Discord maksimal 5 button dalam satu row
      const rows = [];

      for (
        let i = 0;
        i < paymentButtons.length;
        i += 5
      ) {
        rows.push(
          new ActionRowBuilder().addComponents(
            paymentButtons.slice(i, i + 5)
          )
        );
      }

      // ============================
      // ORDER EMBED
      // ============================

      const orderEmbed =
        new EmbedBuilder()
          .setTitle(`🛒 ORDER ${orderId}`)
          .setDescription(
            "Silakan pilih metode pembayaran di bawah."
          )
          .addFields(
            {
              name: "👤 Customer",
              value: `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name: "🎮 Roblox Username",
              value: `\`${username}\``,
              inline: true
            },
            {
              name: "💎 Product",
              value: `**${money(amount)} Robux**`,
              inline: true
            },
            {
              name: "💰 Total",
              value: `**Rp ${money(price)}**`,
              inline: true
            },
            {
              name: "📝 Catatan",
              value: notes,
              inline: false
            },
            {
              name: "📌 Status",
              value: "🟡 WAITING PAYMENT",
              inline: true
            }
          )
          .setColor(0x8b2cff)
          .setFooter({
            text:
              "MAMIYU STORE • Jangan kirim password Roblox kepada siapa pun."
          });

      await channel.send({
        content:
          `<@${interaction.user.id}> <@&${config.roles.staff}>`,
        embeds: [orderEmbed],
        components: rows
      });

      // ============================
      // LOG
      // ============================

      await sendLog(
        interaction.guild,
        "🆕 NEW ORDER",
        `**Order:** ${orderId}\n` +
        `**Customer:** <@${interaction.user.id}>\n` +
        `**Roblox:** \`${username}\`\n` +
        `**Product:** ${amount} Robux\n` +
        `**Total:** Rp ${money(price)}`
      );

      return interaction.reply({
        content:
          `✅ Order berhasil dibuat: <#${channel.id}>`,
        ephemeral: true
      });
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

      const method =
        parts
          .slice(2)
          .join(" ");

      const account =
        config.paymentAccounts?.[method];

      if (!account) {
        return interaction.reply({
          content:
            "❌ Rekening/payment untuk metode ini belum diatur admin.",
          ephemeral: true
        });
      }

      const row =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(`paid_${orderId}`)
            .setLabel("SAYA SUDAH BAYAR")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`close_${orderId}`)
            .setLabel("CANCEL ORDER")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)

        );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `💳 PAYMENT • ${method}`
            )
            .setDescription(
              `Silakan lakukan pembayaran ke:\n\n` +
              `**${account}**\n\n` +
              `Setelah membayar, kirim bukti pembayaran ` +
              `di channel order ini lalu tekan ` +
              `**SAYA SUDAH BAYAR**.`
            )
            .setColor(0x8b2cff)
        ],
        components: [row]
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

      // ============================
      // LOG
      // ============================

      await sendLog(
        interaction.guild,
        "💳 PAYMENT CLAIMED",
        `**Order:** ${orderId}\n` +
        `**Customer:** <@${interaction.user.id}>\n` +
        `Customer menekan tombol **SAYA SUDAH BAYAR**.`,
        0xffc107
      );

      // ============================
      // STAFF VERIFICATION BUTTON
      // ============================

      const verifyRow =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(`verify_${orderId}`)
            .setLabel("VERIFIKASI PEMBAYARAN")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`reject_${orderId}`)
            .setLabel("TOLAK PEMBAYARAN")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)

        );

      await interaction.channel.send({
        content:
          `🔔 <@&${config.roles.staff}>\n` +
          `Customer <@${interaction.user.id}> ` +
          `mengklaim sudah melakukan pembayaran.\n\n` +
          `Staff silakan periksa bukti pembayaran ` +
          `sebelum melakukan verifikasi.`,

        components: [verifyRow]
      });

      return interaction.reply({
        content:
          "✅ Notifikasi pembayaran sudah dikirim ke staff. Silakan tunggu verifikasi.",
        ephemeral: true
      });
    }

    // ==================================================
    // STAFF VERIFY
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("verify_")
    ) {

      if (!staffOnly(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Hanya MAMIYU STAFF yang dapat melakukan verifikasi.",
          ephemeral: true
        });
      }

      const orderId =
        interaction.customId.replace(
          "verify_",
          ""
        );

      // ============================
      // GET ORDER DATA
      // ============================

      let orderData = {};

      if (interaction.channel.topic) {
        try {
          orderData =
            JSON.parse(
              interaction.channel.topic
            );
        } catch {
          orderData = {};
        }
      }

      // ============================
      // UPDATE TOPIC
      // ============================

      orderData.status = "COMPLETED";
      orderData.staffId = interaction.user.id;

      await interaction.channel
        .setTopic(
          JSON.stringify(orderData)
        )
        .catch(() => {});

      // ============================
      // LOG COMPLETED
      // ============================

      await sendLog(
        interaction.guild,
        "🎉 ORDER COMPLETED",
        `**Order:** ${orderId}\n` +
        `**Customer:** <@${orderData.customerId || "unknown"}>\n` +
        `**Roblox:** \`${orderData.username || "-"}\`\n` +
        `**Product:** ${orderData.amount || "-"} Robux\n` +
        `**Total:** Rp ${money(orderData.price || 0)}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** 🎉 COMPLETED`,
        0x00c853
      );

      // ============================
      // COMPLETED MESSAGE
      // ============================

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎉 PEMBAYARAN TERVERIFIKASI")
            .setDescription(
              `Pembayaran untuk **${orderId}** telah diverifikasi oleh staff.\n\n` +
              `**Staff:** <@${interaction.user.id}>\n\n` +
              `Status order: **COMPLETED**`
            )
            .setColor(0x00c853)
            .setTimestamp()
        ]
      });

      // ============================
      // DISABLE VERIFICATION BUTTON
      // ============================

      const disabledRow =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(
              `verified_done_${orderId}`
            )
            .setLabel("SUDAH DIVERIFIKASI")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)

        );

      await interaction.update({
        components: [disabledRow]
      });

      // ============================
      // CLOSE AFTER 10 SECONDS
      // ============================

      setTimeout(async () => {

        await interaction.channel
          .send(
            "🔒 Order selesai. Channel akan ditutup dalam 10 detik."
          )
          .catch(() => {});

        setTimeout(async () => {

          await interaction.channel
            .delete(
              `Order ${orderId} completed`
            )
            .catch(() => {});

        }, 10000);

      }, 1000);

      return;
    }

    // ==================================================
    // STAFF REJECT
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("reject_")
    ) {

      if (!staffOnly(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Hanya MAMIYU STAFF yang dapat melakukan ini.",
          ephemeral: true
        });
      }

      const orderId =
        interaction.customId.replace(
          "reject_",
          ""
        );

      await sendLog(
        interaction.guild,
        "❌ PAYMENT REJECTED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** PAYMENT REJECTED`,
        0xff1744
      );

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("❌ PEMBAYARAN DITOLAK")
            .setDescription(
              `Pembayaran untuk **${orderId}** belum dapat diverifikasi.\n\n` +
              `Staff: <@${interaction.user.id}>\n\n` +
              `Silakan periksa kembali bukti pembayaran ` +
              `atau hubungi staff.`
            )
            .setColor(0xff1744)
            .setTimestamp()
        ]
      });

      return interaction.update({
        components: []
      });
    }

    // ==================================================
    // CLOSE ORDER
    // ==================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("close_")
    ) {

      const orderId =
        interaction.customId.replace(
          "close_",
          ""
        );

      await interaction.reply({
        content:
          "🔒 Order akan ditutup dalam 5 detik."
      });

      setTimeout(async () => {

        await interaction.channel
          .delete(
            `Order ${orderId} cancelled`
          )
          .catch(() => {});

      }, 5000);

      return;
    }

  } catch (error) {

    console.error(
      "INTERACTION ERROR:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {

      await interaction.reply({
        content:
          "❌ Terjadi error pada bot. Staff silakan cek log Railway.",
        ephemeral: true
      }).catch(() => {});

    }
  }
});

// ==================================================
// SHOW ROBUX MENU
// ==================================================

async function showAmountMenu(interaction) {

  const prices =
    config.prices || {};

  const options =
    Object.entries(prices).map(
      ([robux, price]) => ({
        label: `${money(robux)} Robux`,
        description: `Rp ${money(price)}`,
        value: String(robux)
      })
    );

  if (options.length === 0) {
    return interaction.reply({
      content:
        "❌ Price list belum diatur di config.json.",
      ephemeral: true
    });
  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId("robux_amount")
      .setPlaceholder(
        "Pilih nominal Robux..."
      )
      .addOptions(options);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("💜 PILIH NOMINAL")
        .setDescription(
          "Pilih jumlah Robux yang ingin kamu beli."
        )
        .setColor(0x8b2cff)
    ],

    components: [
      new ActionRowBuilder()
        .addComponents(menu)
    ],

    ephemeral: true
  });
}

// ==================================================
// LOGIN
// ==================================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN tidak ditemukan di Railway Variables."
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
