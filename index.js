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

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================================================
// HELPER
// =====================================================

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

function isStaff(member) {
  return (
    member &&
    config.roles &&
    config.roles.staff &&
    member.roles.cache.has(config.roles.staff)
  );
}

function isAdmin(member) {
  return member.permissions.has(
    PermissionFlagsBits.Administrator
  );
}

function saveConfig() {
  fs.writeFileSync(
    "./config.json",
    JSON.stringify(config, null, 2)
  );
}

// =====================================================
// ORDER LOG
// SATU ORDER = SATU PESAN
// =====================================================

async function updateOrderLog(guild, orderId, data = {}) {
  try {
    const channelId = config.channels?.orderLogs;

    if (!channelId) {
      console.log("orderLogs channel belum diatur.");
      return;
    }

    const channel = await guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (!channel) {
      console.log("Channel order logs tidak ditemukan.");
      return;
    }

    // Pastikan object log tersedia
    if (!config.orderLogs) {
      config.orderLogs = {};
    }

    const oldMessageId = config.orderLogs[orderId];

    let oldMessage = null;

    if (oldMessageId) {
      oldMessage = await channel.messages
        .fetch(oldMessageId)
        .catch(() => null);
    }

    // Ambil data lama jika pesan sudah ada
    const oldEmbed = oldMessage?.embeds?.[0];

    function oldField(name, fallback = "-") {
      if (!oldEmbed) return fallback;

      const field = oldEmbed.fields?.find(
        f => f.name === name
      );

      return field?.value || fallback;
    }

    const customer =
      data.customer ||
      oldField("👤 Customer");

    const roblox =
      data.roblox ||
      oldField("🎮 Roblox");

    const product =
      data.product ||
      oldField("💎 Product");

    const total =
      data.total ||
      oldField("💰 Total");

    const status =
      data.status ||
      oldField("📌 Status", "🟡 WAITING PAYMENT");

    const staff =
      data.staff ||
      oldField("🛠️ Staff", "-");

    let color = 0x8b2cff;

    if (status.includes("WAITING")) {
      color = 0x8b2cff;
    }

    if (status.includes("CLAIMED")) {
      color = 0xffc107;
    }

    if (status.includes("VERIFIED")) {
      color = 0x00c853;
    }

    if (status.includes("COMPLETED")) {
      color = 0x00c853;
    }

    if (status.includes("CANCEL")) {
      color = 0xed4245;
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 ORDER LOG")
      .setColor(color)
      .addFields(
        {
          name: "📦 Order ID",
          value: orderId,
          inline: false
        },
        {
          name: "👤 Customer",
          value: customer,
          inline: true
        },
        {
          name: "🎮 Roblox",
          value: roblox,
          inline: true
        },
        {
          name: "💎 Product",
          value: product,
          inline: true
        },
        {
          name: "💰 Total",
          value: total,
          inline: true
        },
        {
          name: "📌 Status",
          value: status,
          inline: true
        },
        {
          name: "🛠️ Staff",
          value: staff,
          inline: true
        }
      )
      .setFooter({
        text: "MAMIYU STORE • Order System"
      })
      .setTimestamp();

    // Jika pesan lama masih ada → EDIT
    if (oldMessage) {
      await oldMessage.edit({
        embeds: [embed]
      });

      saveConfig();
      return;
    }

    // Jika belum ada → BUAT pesan baru
    const newMessage = await channel.send({
      embeds: [embed]
    });

    config.orderLogs[orderId] = newMessage.id;

    saveConfig();

  } catch (error) {
    console.error("ORDER LOG ERROR:", error);
  }
}

// =====================================================
// READY
// =====================================================

client.once("ready", () => {
  console.log("=================================");
  console.log(`MAMIYU BOT ONLINE`);
  console.log(`Login sebagai: ${client.user.tag}`);
  console.log("=================================");
});

// =====================================================
// INTERACTION
// =====================================================

client.on("interactionCreate", async interaction => {

  try {

    // =================================================
    // SLASH COMMAND
    // =================================================

    if (interaction.isChatInputCommand()) {

      // =================================================
      // SETUP
      // =================================================

      if (interaction.commandName === "setup") {

        if (!isAdmin(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Hanya administrator yang dapat menjalankan setup.",
            ephemeral: true
          });
        }

        await interaction.deferReply({
          ephemeral: true
        });

        const guild = interaction.guild;

        // -----------------------------------------------
        // STAFF ROLE
        // -----------------------------------------------

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

        config.roles = config.roles || {};
        config.roles.staff = staffRole.id;

        // -----------------------------------------------
        // CATEGORY
        // -----------------------------------------------

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

        // -----------------------------------------------
        // TEXT CHANNEL
        // -----------------------------------------------

        async function findOrCreateText(
          name,
          parent
        ) {

          let channel = guild.channels.cache.find(
            ch =>
              ch.type === ChannelType.GuildText &&
              ch.name === name
          );

          if (!channel) {
            channel = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: parent.id
            });
          }

          return channel;
        }

        const information =
          await findOrCreateCategory(
            "📌 INFORMATION"
          );

        const store =
          await findOrCreateCategory(
            "🛒 ROBUX STORE"
          );

        const orders =
          await findOrCreateCategory(
            "🎫 ORDERS"
          );

        const staff =
          await findOrCreateCategory(
            "🔐 STAFF"
          );

        // -----------------------------------------------
        // CHANNEL
        // -----------------------------------------------

        const announcement =
          await findOrCreateText(
            "📢・announcement",
            information
          );

        const rules =
          await findOrCreateText(
            "📜・rules",
            information
          );

        const priceList =
          await findOrCreateText(
            "💰・price-list",
            information
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

        // -----------------------------------------------
        // SAVE CHANNEL ID
        // -----------------------------------------------

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

        if (!config.orderLogs) {
          config.orderLogs = {};
        }

        saveConfig();

        // -----------------------------------------------
        // PRICE LIST
        // -----------------------------------------------

        const priceEmbed = new EmbedBuilder()
          .setTitle(
            "💜 MAMIYU STORE — TOP UP ROBUX"
          )
          .setDescription(
            "Harga eceran Robux • Via Username\n\n" +
            "Pilih nominal melalui `/buy` untuk membuat order."
          )
          .setColor(0x8b2cff)
          .setFooter({
            text:
              "MAMIYU STORE • Trusted • Fast • Safe"
          });

        const priceLines =
          Object.entries(config.prices)
            .map(
              ([robux, price]) =>
                `**${money(robux)} RBX** → **Rp ${money(price)}**`
            )
            .join("\n");

        priceEmbed.addFields({
          name: "💎 PRICE LIST",
          value: priceLines.slice(0, 1024)
        });

        await priceList
          .send({
            embeds: [priceEmbed]
          })
          .catch(() => {});

        // -----------------------------------------------
        // BUY PANEL
        // -----------------------------------------------

        const buyEmbed = new EmbedBuilder()
          .setTitle(
            "🛒 MAMIYU ROBUX STORE"
          )
          .setDescription(
            "Butuh Robux? Buat order langsung di sini.\n\n" +
            "⚡ Proses cepat\n" +
            "🔒 Aman & terpercaya\n" +
            "💜 Pelayanan ramah\n\n" +
            "Klik tombol **BUY ROBUX** untuk mulai."
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
          "Gunakan `/buy` untuk menguji order."
        );
      }

      // =================================================
      // PRICE
      // =================================================

      if (interaction.commandName === "price") {

        const lines =
          Object.entries(config.prices)
            .map(
              ([robux, price]) =>
                `**${money(robux)} RBX** → **Rp ${money(price)}**`
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
                text:
                  "Via Username • MAMIYU STORE"
              })
          ]
        });
      }

      // =================================================
      // BUY
      // =================================================

      if (interaction.commandName === "buy") {

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId("robux_amount")
            .setPlaceholder(
              "Pilih nominal Robux..."
            )
            .addOptions(
              Object.entries(config.prices)
                .map(
                  ([robux, price]) => ({
                    label:
                      `${money(robux)} Robux`,
                    description:
                      `Rp ${money(price)}`,
                    value: String(robux)
                  })
                )
            );

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🛒 MAMIYU ROBUX STORE"
              )
              .setDescription(
                "Pilih nominal Robux yang ingin kamu beli."
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
    }

    // =================================================
    // BUY BUTTON
    // =================================================

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
            Object.entries(config.prices)
              .map(
                ([robux, price]) => ({
                  label:
                    `${money(robux)} Robux`,
                  description:
                    `Rp ${money(price)}`,
                  value: String(robux)
                })
              )
          );

      return interaction.reply({
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
          new ActionRowBuilder()
            .addComponents(menu)
        ],
        ephemeral: true
      });
    }

    // =================================================
    // PILIH NOMINAL
    // =================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "robux_amount"
    ) {

      const amount =
        interaction.values[0];

      const modal =
        new ModalBuilder()
          .setCustomId(
            `order_modal_${amount}`
          )
          .setTitle(
            "MAMIYU • Data Order"
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
        new ActionRowBuilder()
          .addComponents(username),

        new ActionRowBuilder()
          .addComponents(notes)
      );

      return interaction.showModal(modal);
    }

    // =================================================
    // MODAL ORDER
    // =================================================

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
        return interaction.reply({
          content:
            "❌ Harga Robux tidak ditemukan di config.json.",
          ephemeral: true
        });
      }

      const orderId =
        makeId();

      const category =
        await interaction.guild.channels
          .fetch(
            config.channels.ordersCategory
          )
          .catch(() => null);

      if (!category) {
        return interaction.reply({
          content:
            "❌ Category order belum dibuat. Jalankan `/setup`.",
          ephemeral: true
        });
      }

      // -----------------------------------------------
      // CREATE ORDER CHANNEL
      // -----------------------------------------------

      const channel =
        await interaction.guild.channels.create({
          name:
            `order-${orderId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: category.id,

          permissionOverwrites: [
            {
              id:
                interaction.guild.roles.everyone.id,

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

      // -----------------------------------------------
      // PAYMENT BUTTONS
      // -----------------------------------------------

      const paymentButtons =
        new ActionRowBuilder();

      for (
        let i = 0;
        i < config.paymentMethods.length;
        i++
      ) {

        const method =
          config.paymentMethods[i];

        paymentButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `pay_${orderId}_${i}`
            )
            .setLabel(method)
            .setStyle(
              i === 0
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
        );
      }

      // -----------------------------------------------
      // ORDER EMBED
      // -----------------------------------------------

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
              inline: true
            },

            {
              name: "🎮 Roblox Username",
              value:
                `\`${username}\``,
              inline: true
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

        embeds: [embed],

        components: [
          paymentButtons
        ]
      });

      // -----------------------------------------------
      // CREATE SINGLE LOG
      // -----------------------------------------------

      await updateOrderLog(
        interaction.guild,
        orderId,
        {
          customer:
            `<@${interaction.user.id}>`,

          roblox:
            `\`${username}\``,

          product:
            `${money(amount)} Robux`,

          total:
            `Rp ${money(price)}`,

          status:
            "🟡 WAITING PAYMENT",

          staff: "-"
        }
      );

      return interaction.reply({
        content:
          `✅ Order berhasil dibuat!\n\n` +
          `📦 Order: **${orderId}**\n` +
          `🎫 Channel: <#${channel.id}>`,

        ephemeral: true
      });
    }

    // =================================================
    // PILIH PAYMENT
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pay_")
    ) {

      const parts =
        interaction.customId.split("_");

      const orderId =
        parts[1];

      const methodIndex =
        Number(parts[2]);

      const method =
        config.paymentMethods[
          methodIndex
        ];

      const account =
        config.paymentAccounts?.[method] ||
        "Belum diatur oleh admin.";

      const row =
        new ActionRowBuilder()
          .addComponents(

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
              `💳 PAYMENT • ${method}`
            )
            .setDescription(
              `Silakan lakukan pembayaran ke:\n\n` +
              `**${account}**\n\n` +
              `Setelah membayar, kirim bukti pembayaran ` +
              `di channel order ini lalu klik ` +
              `**SAYA SUDAH BAYAR**.`
            )
            .setColor(0x8b2cff)
        ],

        components: [row]
      });
    }

    // =================================================
    // SAYA SUDAH BAYAR
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "paid_"
      )
    ) {

      const orderId =
        interaction.customId.replace(
          "paid_",
          ""
        );

      // Update log yang sama
      await updateOrderLog(
        interaction.guild,
        orderId,
        {
          status:
            "🟠 PAYMENT CLAIMED"
        }
      );

      // -----------------------------------------------
      // STAFF BUTTONS
      // -----------------------------------------------

      const staffButtons =
        new ActionRowBuilder()
          .addComponents(

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
                "CANCEL ORDER"
              )
              .setEmoji("❌")
              .setStyle(
                ButtonStyle.Danger
              )
          );

      await interaction.channel.send({
        content:
          `<@&${config.roles.staff}>`,

        embeds: [
          new EmbedBuilder()
            .setTitle(
              "💳 PAYMENT CLAIMED"
            )
            .setDescription(
              `Customer <@${interaction.user.id}> ` +
              `mengklaim sudah melakukan pembayaran.\n\n` +
              `Silakan staff cek bukti pembayaran.`
            )
            .setColor(0xffc107)
        ],

        components: [staffButtons]
      });

      return interaction.reply({
        content:
          "✅ Pembayaran dilaporkan ke staff.\n" +
          "Silakan tunggu verifikasi.",
        ephemeral: true
      });
    }

    // =================================================
    // VERIFY PAYMENT
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "verify_"
      )
    ) {

      if (!isStaff(interaction.member)) {
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

      // Update single log
      await updateOrderLog(
        interaction.guild,
        orderId,
        {
          status:
            "🟢 PAYMENT VERIFIED",

          staff:
            `<@${interaction.user.id}>`
        }
      );

      // -----------------------------------------------
      // BUTTON SELESAIKAN
      // -----------------------------------------------

      const row =
        new ActionRowBuilder()
          .addComponents(

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
          `<@&${config.roles.staff}>`,

        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🔎 PAYMENT VERIFIED"
            )
            .setDescription(
              `Pembayaran telah diverifikasi oleh ` +
              `<@${interaction.user.id}>` +
              `.\n\n` +
              `Jika Robux sudah dikirim, tekan ` +
              `**SELESAIKAN ORDER**.`
            )
            .setColor(0x00c853)
        ],

        components: [row]
      });

      return interaction.reply({
        content:
          `✅ Pembayaran **${orderId}** berhasil diverifikasi.`,
        ephemeral: true
      });
    }

    // =================================================
    // COMPLETE ORDER
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "complete_"
      )
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Hanya MAMIYU STAFF yang dapat menyelesaikan order.",
          ephemeral: true
        });
      }

      const orderId =
        interaction.customId.replace(
          "complete_",
          ""
        );

      // Update log
      await updateOrderLog(
        interaction.guild,
        orderId,
        {
          status:
            "🎉 COMPLETED",

          staff:
            `<@${interaction.user.id}>`
        }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🎉 ORDER COMPLETED"
            )
            .setDescription(
              `Order **${orderId}** telah selesai.\n\n` +
              `Terima kasih sudah berbelanja di **MAMIYU STORE** 💜`
            )
            .setColor(0x00c853)
        ]
      });

      // -----------------------------------------------
      // AUTO CLOSE 10 DETIK
      // -----------------------------------------------

      setTimeout(async () => {

        await interaction.channel
          .send(
            "🔒 Order akan ditutup dalam 5 detik."
          )
          .catch(() => {});

        setTimeout(async () => {

          await interaction.channel
            .delete(
              `Completed order ${orderId}`
            )
            .catch(() => {});

        }, 5000);

      }, 5000);

      return;
    }

    // =================================================
    // CANCEL ORDER
    // =================================================

    if (
      interaction.isButton() &&
      (
        interaction.customId.startsWith(
          "cancel_"
        ) ||
        interaction.customId.startsWith(
          "close_"
        )
      )
    ) {

      const orderId =
        interaction.customId
          .replace("cancel_", "")
          .replace("close_", "");

      // Update log
      await updateOrderLog(
        interaction.guild,
        orderId,
        {
          status:
            "🔴 CANCELLED",

          staff:
            isStaff(interaction.member)
              ? `<@${interaction.user.id}>`
              : "-"
        }
      );

      await interaction.reply(
        "🔒 Order akan ditutup dalam 5 detik."
      );

      setTimeout(async () => {

        await interaction.channel
          .delete(
            `Cancelled order ${orderId}`
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
          "❌ Terjadi error pada bot.\n" +
          "Staff silakan cek log Railway.",

        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =====================================================
// LOGIN
// =====================================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN tidak ditemukan!"
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
