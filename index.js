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

// ===============================
// CLIENT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===============================
// HELPER
// ===============================

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
  if (!member || !config.roles || !config.roles.staff) {
    return false;
  }

  return member.roles.cache.has(config.roles.staff);
}

async function sendLog(guild, title, description, color = 0x8b2cff) {
  try {
    const id = config.channels?.orderLogs;

    if (!id) return;

    const channel = await guild.channels.fetch(id).catch(() => null);

    if (!channel) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setTimestamp()
          .setFooter({
            text: "MAMIYU STORE • Auto-System"
          })
      ]
    });
  } catch (error) {
    console.error("Gagal mengirim log:", error);
  }
}

async function sendPaymentLog(guild, title, description) {
  try {
    const id = config.channels?.paymentLogs;

    if (!id) {
      return sendLog(guild, title, description);
    }

    const channel = await guild.channels.fetch(id).catch(() => null);

    if (!channel) return;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(0x00c853)
          .setTimestamp()
          .setFooter({
            text: "MAMIYU STORE • Payment System"
          })
      ]
    });
  } catch (error) {
    console.error("Gagal mengirim payment log:", error);
  }
}

// ===============================
// READY
// ===============================

client.once("ready", () => {
  console.log("=================================");
  console.log(`MAMIYU BOT ONLINE`);
  console.log(`Login sebagai: ${client.user.tag}`);
  console.log(`Bot ID: ${client.user.id}`);
  console.log("=================================");
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

      // ===================================================
      // /setup
      // ===================================================

      if (interaction.commandName === "setup") {

        if (
          !interaction.memberPermissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {
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

        // ===============================
        // STAFF ROLE
        // ===============================

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

        // ===============================
        // CATEGORY
        // ===============================

        const findOrCreateCategory = async (name) => {

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
        };

        // ===============================
        // TEXT CHANNEL
        // ===============================

        const findOrCreateText = async (
          name,
          parent,
          options = {}
        ) => {

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
        };

        const info = await findOrCreateCategory(
          "📌 INFORMATION"
        );

        const store = await findOrCreateCategory(
          "🛒 ROBUX STORE"
        );

        const orders = await findOrCreateCategory(
          "🎫 ORDERS"
        );

        const staff = await findOrCreateCategory(
          "🔐 STAFF"
        );

        // ===============================
        // CHANNELS
        // ===============================

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

        // ===============================
        // SAVE CONFIG
        // ===============================

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

        // ===============================
        // PRICE LIST
        // ===============================

        const priceLines =
          Object.entries(config.prices)
            .map(
              ([robux, price]) =>
                `**${money(robux)} RBX** → **Rp ${money(price)}**`
            )
            .join("\n");

        const priceEmbed =
          new EmbedBuilder()
            .setTitle(
              "💜 MAMIYU STORE — PRICE LIST"
            )
            .setDescription(
              "Harga Robux via Username\n\n" +
              priceLines
            )
            .setColor(0x8b2cff)
            .setFooter({
              text:
                "MAMIYU STORE • Trusted • Fast • Safe"
            });

        await priceList.send({
          embeds: [priceEmbed]
        }).catch(() => {});

        // ===============================
        // BUY ROBUX PANEL
        // ===============================

        const buyEmbed =
          new EmbedBuilder()
            .setTitle(
              "🛒 MAMIYU ROBUX STORE"
            )
            .setDescription(
              "Butuh Robux?\n\n" +
              "⚡ Proses cepat\n" +
              "🔒 Aman & terpercaya\n" +
              "💜 Pelayanan ramah\n\n" +
              "Klik tombol **BUY ROBUX** untuk membuat order."
            )
            .setColor(0x8b2cff);

        const buyRow =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId("buy_robux")
                .setLabel("BUY ROBUX")
                .setEmoji("🛒")
                .setStyle(ButtonStyle.Primary)
            );

        await createOrder.send({
          embeds: [buyEmbed],
          components: [buyRow]
        }).catch(() => {});

        await interaction.editReply(
          "✅ Setup MAMIYU Store selesai.\n\n" +
          "Bot siap menerima order."
        );

        return;
      }

      // ===================================================
      // /price
      // ===================================================

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

      // ===================================================
      // /buy
      // ===================================================

      if (interaction.commandName === "buy") {

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId("robux_amount")
            .setPlaceholder(
              "Pilih nominal Robux..."
            )
            .addOptions(
              Object.entries(config.prices)
                .map(([robux, price]) => ({
                  label:
                    `${money(robux)} Robux`,
                  description:
                    `Rp ${money(price)}`,
                  value: String(robux)
                }))
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

    // =====================================================
    // BUY ROBUX BUTTON
    // =====================================================

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
              .map(([robux, price]) => ({
                label:
                  `${money(robux)} Robux`,
                description:
                  `Rp ${money(price)}`,
                value: String(robux)
              }))
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

    // =====================================================
    // SELECT ROBUX
    // =====================================================

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
        new ActionRowBuilder()
          .addComponents(username),
        new ActionRowBuilder()
          .addComponents(notes)
      );

      return interaction.showModal(modal);
    }

    // =====================================================
    // MODAL ORDER
    // =====================================================

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
            "❌ Harga Robux tidak ditemukan.",
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
            "❌ Category order belum tersedia. Jalankan `/setup`.",
          ephemeral: true
        });
      }

      // ===============================
      // ORDER CHANNEL
      // ===============================

      const channel =
        await interaction.guild.channels.create({
          name:
            `order-${orderId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: category.id,

          permissionOverwrites: [
            {
              id:
                interaction.guild.roles
                  .everyone.id,

              deny: [
                PermissionFlagsBits.ViewChannel
              ]
            },

            {
              id:
                interaction.user.id,

              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },

            {
              id:
                config.roles.staff,

              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

      // ===============================
      // PAYMENT BUTTONS
      // ===============================

      const paymentMethods =
        Array.isArray(
          config.paymentMethods
        )
          ? config.paymentMethods
          : [];

      const paymentButtons =
        new ActionRowBuilder();

      for (
        let i = 0;
        i < paymentMethods.length;
        i++
      ) {

        const method =
          paymentMethods[i];

        paymentButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `pay_${orderId}_${method
                .replace(/\s/g, "_")}`
            )
            .setLabel(method)
            .setStyle(
              i === 0
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
        );
      }

      // ===============================
      // ORDER EMBED
      // ===============================

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
              name:
                "🎮 Roblox Username",
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

        components:
          paymentButtons.components.length
            ? [paymentButtons]
            : []
      });

      // ===============================
      // LOG
      // ===============================

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
          `✅ Order dibuat: <#${channel.id}>`,
        ephemeral: true
      });
    }

    // =====================================================
    // PAYMENT METHOD
    // =====================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pay_")
    ) {

      const parts =
        interaction.customId.split("_");

      const orderId =
        parts[1];

      const method =
        parts
          .slice(2)
          .join(" ");

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
              `Setelah membayar:\n` +
              `1. Kirim bukti pembayaran di channel ini.\n` +
              `2. Klik **SAYA SUDAH BAYAR**.\n\n` +
              `⚠️ Jangan kirim password Roblox.`
            )
            .setColor(0x8b2cff)
        ],
        components: [row]
      });
    }

    // =====================================================
    // CUSTOMER CLAIM PAYMENT
    // =====================================================

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

      // ===============================
      // NOTIFY STAFF
      // ===============================

      const staffRole =
        config.roles?.staff;

      await interaction.channel.send({
        content:
          staffRole
            ? `<@&${staffRole}>`
            : "",

        embeds: [
          new EmbedBuilder()
            .setTitle(
              "💳 PAYMENT CLAIMED"
            )
            .setDescription(
              `Customer <@${interaction.user.id}> ` +
              `mengatakan sudah melakukan pembayaran.\n\n` +
              `**Order:** ${orderId}\n\n` +
              `Silakan staff periksa bukti pembayaran sebelum melakukan verifikasi.`
            )
            .setColor(0xffc107)
            .setTimestamp()
        ],

        components: [
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `verify_${orderId}`
                )
                .setLabel(
                  "VERIFIKASI PEMBAYARAN"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `reject_${orderId}`
                )
                .setLabel(
                  "TOLAK PEMBAYARAN"
                )
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
            )
        ]
      });

      await sendPaymentLog(
        interaction.guild,
        "💳 PAYMENT CLAIMED",
        `**Order:** ${orderId}\n` +
        `**Customer:** <@${interaction.user.id}>\n\n` +
        `Customer menekan tombol **Saya Sudah Bayar**.\n\n` +
        `Status: 🟡 MENUNGGU VERIFIKASI STAFF`
      );

      return interaction.reply({
        content:
          "✅ Pembayaran sudah dilaporkan kepada staff.\n" +
          "Silakan tunggu proses verifikasi.",
        ephemeral: true
      });
    }

    // =====================================================
    // STAFF VERIFY
    // =====================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "verify_"
      )
    ) {

      // ===============================
      // STAFF CHECK
      // ===============================

      if (!staffOnly(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Kamu bukan staff. Hanya MAMIYU STAFF yang dapat melakukan verifikasi.",
          ephemeral: true
        });
      }

      const orderId =
        interaction.customId.replace(
          "verify_",
          ""
        );

      // ===============================
      // UPDATE MESSAGE
      // ===============================

      const verifiedEmbed =
        new EmbedBuilder()
          .setTitle(
            "✅ PEMBAYARAN TERVERIFIKASI"
          )
          .setDescription(
            `Pembayaran untuk order **${orderId}** telah diverifikasi oleh staff.\n\n` +
            `👤 Staff: <@${interaction.user.id}>\n\n` +
            `Silakan lanjutkan proses pengiriman Robux.`
          )
          .setColor(0x00c853)
          .setTimestamp();

      await interaction.message.edit({
        embeds: [
          verifiedEmbed
        ],
        components: []
      }).catch(() => {});

      // ===============================
      // LOG
      // ===============================

      await sendPaymentLog(
        interaction.guild,
        "✅ PAYMENT VERIFIED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** 🟢 PAYMENT VERIFIED`
      );

      await sendLog(
        interaction.guild,
        "✅ ORDER PAYMENT VERIFIED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** 🟢 PAYMENT VERIFIED`,
        0x00c853
      );

      // ===============================
      // CUSTOMER NOTIFICATION
      // ===============================

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ PEMBAYARAN BERHASIL DIVERIFIKASI"
            )
            .setDescription(
              `Pembayaran kamu untuk **${orderId}** telah diverifikasi.\n\n` +
              `💎 Staff akan memproses Robux kamu.\n\n` +
              `Mohon tunggu sampai proses selesai.`
            )
            .setColor(0x00c853)
            .setTimestamp()
        ]
      });

      return interaction.reply({
        content:
          `✅ Pembayaran **${orderId}** berhasil diverifikasi.`,
        ephemeral: true
      });
    }

    // =====================================================
    // STAFF REJECT
    // =====================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "reject_"
      )
    ) {

      // ===============================
      // STAFF CHECK
      // ===============================

      if (!staffOnly(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Kamu bukan staff. Hanya MAMIYU STAFF yang dapat melakukan ini.",
          ephemeral: true
        });
      }

      const orderId =
        interaction.customId.replace(
          "reject_",
          ""
        );

      const rejectedEmbed =
        new EmbedBuilder()
          .setTitle(
            "❌ PEMBAYARAN DITOLAK"
          )
          .setDescription(
            `Pembayaran untuk order **${orderId}** ditolak oleh staff.\n\n` +
            `👤 Staff: <@${interaction.user.id}>\n\n` +
            `Silakan periksa kembali bukti pembayaran atau hubungi staff.`
          )
          .setColor(0xff1744)
          .setTimestamp();

      await interaction.message.edit({
        embeds: [
          rejectedEmbed
        ],
        components: []
      }).catch(() => {});

      await sendPaymentLog(
        interaction.guild,
        "❌ PAYMENT REJECTED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** 🔴 PAYMENT REJECTED`
      );

      await sendLog(
        interaction.guild,
        "❌ PAYMENT REJECTED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n` +
        `**Status:** 🔴 PAYMENT REJECTED`,
        0xff1744
      );

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "❌ PEMBAYARAN BELUM DIVERIFIKASI"
            )
            .setDescription(
              `Pembayaran untuk **${orderId}** belum dapat diverifikasi.\n\n` +
              `Silakan hubungi staff dan pastikan bukti pembayaran sudah benar.`
            )
            .setColor(0xff1744)
        ]
      });

      return interaction.reply({
        content:
          `❌ Pembayaran **${orderId}** ditolak.`,
        ephemeral: true
      });
    }

    // =====================================================
    // CLOSE ORDER
    // =====================================================

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

      await interaction.reply({
        content:
          "🔒 Order akan ditutup dalam 5 detik."
      });

      await sendLog(
        interaction.guild,
        "🔒 ORDER CANCELLED",
        `**Order:** ${orderId}\n` +
        `**By:** <@${interaction.user.id}>\n` +
        `**Status:** CANCELLED`
      );

      setTimeout(async () => {

        await interaction.channel
          .delete(
            `Closed order ${orderId}`
          )
          .catch(() => {});

      }, 5000);

      return;
    }

  } catch (error) {

    console.error(
      "================================="
    );

    console.error(
      "INTERACTION ERROR:"
    );

    console.error(error);

    console.error(
      "================================="
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {

      await interaction.reply({
        content:
          "❌ Terjadi error pada bot. Staff/admin silakan cek console Railway.",
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
).catch(error => {

  console.error(
    "❌ GAG
