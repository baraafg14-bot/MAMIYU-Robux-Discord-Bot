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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// HELPER
// =========================

function money(number) {
  return new Intl.NumberFormat("id-ID").format(Number(number));
}

function makeOrderId() {
  return (
    "RBX-" +
    Math.random().toString(36).substring(2, 7).toUpperCase() +
    "-" +
    Date.now().toString().slice(-4)
  );
}

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.has(config.roles?.staff)
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

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    await channel.send({
      embeds: [embed]
    });
  } catch (error) {
    console.error("LOG ERROR:", error);
  }
}

function getPrice(amount) {
  if (!config.prices) return null;

  return config.prices[String(amount)];
}

function createAmountMenu() {
  const options = Object.entries(config.prices || {})
    .map(([robux, price]) => ({
      label: `${money(robux)} Robux`,
      description: `Rp ${money(price)}`,
      value: String(robux)
    }))
    .slice(0, 25);

  return new StringSelectMenuBuilder()
    .setCustomId("robux_amount")
    .setPlaceholder("Pilih nominal Robux...")
    .addOptions(options);
}

// =========================
// READY
// =========================

client.once("ready", () => {
  console.log("================================");
  console.log(`BOT ONLINE: ${client.user.tag}`);
  console.log(`SERVER: ${client.guilds.cache.size}`);
  console.log("================================");
});

// =========================
// INTERACTION
// =========================

client.on("interactionCreate", async (interaction) => {
  try {

    // ==========================================
    // SLASH COMMAND
    // ==========================================

    if (interaction.isChatInputCommand()) {

      // =========================
      // /price
      // =========================

      if (interaction.commandName === "price") {

        const lines = Object.entries(config.prices || {})
          .map(
            ([robux, price]) =>
              `**${money(robux)} RBX** → **Rp ${money(price)}**`
          )
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("💜 MAMIYU STORE — PRICE LIST")
              .setDescription(lines || "Price list belum diatur.")
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

        const menu = createAmountMenu();

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
            new ActionRowBuilder().addComponents(menu)
          ],
          ephemeral: true
        });
      }

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
            content:
              "❌ Hanya administrator yang dapat menjalankan setup.",
            ephemeral: true
          });
        }

        await interaction.deferReply({
          ephemeral: true
        });

        const guild = interaction.guild;

        // STAFF ROLE
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

        // CATEGORY
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

        // CHANNEL
        async function findOrCreateChannel(
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
              parent
            });
          }

          return channel;
        }

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

        const announcement =
          await findOrCreateChannel(
            "📢・announcement",
            info
          );

        const rules =
          await findOrCreateChannel(
            "📜・rules",
            info
          );

        const priceList =
          await findOrCreateChannel(
            "💰・price-list",
            info
          );

        const createOrder =
          await findOrCreateChannel(
            "🛍️・create-order",
            store
          );

        const testimonials =
          await findOrCreateChannel(
            "⭐・testimonials",
            store
          );

        const orderLogs =
          await findOrCreateChannel(
            "📋・order-logs",
            staff
          );

        const paymentLogs =
          await findOrCreateChannel(
            "💳・payment-logs",
            staff
          );

        const staffChat =
          await findOrCreateChannel(
            "🛠️・staff-chat",
            staff
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
          ordersCategory: orders.id
        };

        fs.writeFileSync(
          "./config.json",
          JSON.stringify(config, null, 2)
        );

        // PRICE LIST
        const priceLines = Object.entries(
          config.prices || {}
        )
          .map(
            ([robux, price]) =>
              `**${money(robux)} RBX** → **Rp ${money(price)}**`
          )
          .join("\n");

        const priceEmbed = new EmbedBuilder()
          .setTitle("💜 MAMIYU STORE — PRICE LIST")
          .setDescription(priceLines)
          .setColor(0x8b2cff)
          .setFooter({
            text: "Via Username • MAMIYU STORE"
          });

        await priceList.send({
          embeds: [priceEmbed]
        });

        // BUY BUTTON
        const buyEmbed = new EmbedBuilder()
          .setTitle("🛒 MAMIYU ROBUX STORE")
          .setDescription(
            "Butuh Robux?\n\n" +
            "⚡ Proses cepat\n" +
            "🔒 Aman\n" +
            "💜 Pelayanan ramah\n\n" +
            "Klik **BUY ROBUX** untuk mulai."
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

        await createOrder.send({
          embeds: [buyEmbed],
          components: [buyButton]
        });

        return interaction.editReply(
          "✅ Setup MAMIYU Store berhasil."
        );
      }
    }

    // ==========================================
    // BUY ROBUX BUTTON
    // ==========================================

    if (
      interaction.isButton() &&
      interaction.customId === "buy_robux"
    ) {

      const menu = createAmountMenu();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💜 PILIH NOMINAL")
            .setDescription(
              "Pilih jumlah Robux yang ingin kamu order."
            )
            .setColor(0x8b2cff)
        ],
        components: [
          new ActionRowBuilder().addComponents(menu)
        ],
        ephemeral: true
      });
    }

    // ==========================================
    // PILIH NOMINAL
    // ==========================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "robux_amount"
    ) {

      const amount = String(
        interaction.values[0]
      );

      const price = getPrice(amount);

      if (!price) {
        return interaction.reply({
          content:
            "❌ Nominal tersebut tidak ditemukan di config.json.",
          ephemeral: true
        });
      }

      const modal =
        new ModalBuilder()
          .setCustomId(
            `order_modal_${amount}`
          )
          .setTitle("MAMIYU • DATA ORDER");

      const usernameInput =
        new TextInputBuilder()
          .setCustomId("roblox_username")
          .setLabel("Username Roblox")
          .setPlaceholder(
            "Contoh: RobloxPlayer123"
          )
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30);

      const notesInput =
        new TextInputBuilder()
          .setCustomId("notes")
          .setLabel("Catatan (opsional)")
          .setPlaceholder(
            "Contoh: proses secepatnya"
          )
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          usernameInput
        ),
        new ActionRowBuilder().addComponents(
          notesInput
        )
      );

      return interaction.showModal(modal);
    }

    // ==========================================
    // SUBMIT MODAL
    // ==========================================

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

      const price = getPrice(amount);

      if (!price) {
        return interaction.reply({
          content:
            "❌ Harga Robux tidak ditemukan.",
          ephemeral: true
        });
      }

      const orderId = makeOrderId();

      const category =
        await interaction.guild.channels.fetch(
          config.channels.ordersCategory
        ).catch(() => null);

      if (!category) {
        return interaction.reply({
          content:
            "❌ Category order tidak ditemukan. Jalankan `/setup`.",
          ephemeral: true
        });
      }

      const staffRoleId =
        config.roles?.staff;

      if (!staffRoleId) {
        return interaction.reply({
          content:
            "❌ Role MAMIYU STAFF belum diatur. Jalankan `/setup`.",
          ephemeral: true
        });
      }

      // CREATE ORDER CHANNEL
      const orderChannel =
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
              id: staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

      // PAYMENT METHODS
      const methods =
        Array.isArray(config.paymentMethods)
          ? config.paymentMethods
          : ["OVO", "GOPAY", "DANA", "BANK TRANSFER"];

      const paymentButtons =
        new ActionRowBuilder();

      methods
        .slice(0, 5)
        .forEach((method, index) => {

          paymentButtons.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `pay_${orderId}_${index}`
              )
              .setLabel(String(method))
              .setStyle(
                index === 0
                  ? ButtonStyle.Primary
                  : ButtonStyle.Secondary
              )
          );
        });

      const orderEmbed =
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
              inline: false
            }
          )
          .setColor(0x8b2cff)
          .setFooter({
            text:
              "MAMIYU STORE • Jangan pernah kirim password Roblox."
          });

      await orderChannel.send({
        content:
          `<@${interaction.user.id}> <@&${staffRoleId}>`,

        embeds: [orderEmbed],

        components: [
          paymentButtons
        ]
      });

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
          `✅ Order berhasil dibuat!\n\n📦 Order: <#${orderChannel.id}>`,
        ephemeral: true
      });
    }

    // ==========================================
    // PILIH PAYMENT
    // ==========================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pay_")
    ) {

      const parts =
        interaction.customId.split("_");

      const orderId = parts[1];

      const methodIndex =
        Number(parts[2]);

      const methods =
        Array.isArray(config.paymentMethods)
          ? config.paymentMethods
          : ["OVO", "GOPAY", "DANA", "BANK TRANSFER"];

      const method =
        methods[methodIndex] || methods[0];

      const account =
        config.paymentAccounts?.[method] ||
        "Belum diatur admin.";

      const buttons =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(
              `paid_${orderId}`
            )
            .setLabel("SAYA SUDAH BAYAR")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(
              `close_${orderId}`
            )
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
              `Setelah membayar, kirim bukti pembayaran di channel order ini.\n\n` +
              `Kemudian tekan **SAYA SUDAH BAYAR**.`
            )
            .setColor(0x8b2cff)
        ],
        components: [buttons]
      });
    }

    // ==========================================
    // CUSTOMER SUDAH BAYAR
    // ==========================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("paid_")
    ) {

      const orderId =
        interaction.customId.replace(
          "paid_",
          ""
        );

      await sendLog(
        interaction.guild,
        "💳 PAYMENT CLAIMED",
        `**Order:** ${orderId}\n` +
        `**Customer:** <@${interaction.user.id}>\n\n` +
        `Customer menekan **SAYA SUDAH BAYAR**.`,
        0xffc107
      );

      // STAFF VERIFICATION BUTTONS
      const staffButtons =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(
              `verify_${orderId}`
            )
            .setLabel("VERIFIKASI PEMBAYARAN")
            .setEmoji("🔎")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId(
              `complete_${orderId}`
            )
            .setLabel("SELESAIKAN ORDER")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(
              `reject_${orderId}`
            )
            .setLabel("TOLAK")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.channel.send({
        content:
          `<@&${config.roles.staff}> 📢 **PAYMENT CLAIMED**\n` +
          `Customer: <@${interaction.user.id}>`,

        embeds: [
          new EmbedBuilder()
            .setTitle(
              `💳 VERIFIKASI PAYMENT • ${orderId}`
            )
            .setDescription(
              "Customer mengaku sudah melakukan pembayaran.\n\n" +
              "Staff silakan cek bukti pembayaran yang dikirim customer."
            )
            .setColor(0xffc107)
        ],

        components: [
          staffButtons
        ]
      });

      return interaction.reply({
        content:
          "✅ Pembayaran ditandai sebagai **SUDAH BAYAR**.\nStaff akan melakukan verifikasi.",
        ephemeral: true
      });
    }

    // ==========================================
    // STAFF VERIFIKASI
    // ==========================================

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

      await sendLog(
        interaction.guild,
        "🔎 PAYMENT VERIFIED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n\n` +
        `Pembayaran telah diverifikasi staff.`,
        0x00c853
      );

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ PEMBAYARAN TERVERIFIKASI"
            )
            .setDescription(
              `Order **${orderId}** telah diverifikasi oleh <@${interaction.user.id}>.\n\n` +
              "Silakan lanjutkan proses pengiriman Robux."
            )
            .setColor(0x00c853)
        ]
      });

      return interaction.reply({
        content:
          "✅ Pembayaran berhasil diverifikasi.",
        ephemeral: true
      });
    }

    // ==========================================
    // COMPLETE ORDER
    // ==========================================

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

      await sendLog(
        interaction.guild,
        "🎉 ORDER COMPLETED",
        `**Order:** ${orderId}\n` +
        `**Staff:** <@${interaction.user.id}>\n\n` +
        `Order telah diselesaikan.`,
        0x00c853
      );

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🎉 ORDER SELESAI"
            )
            .setDescription(
              `Order **${orderId}** telah selesai.\n\n` +
              `Diproses oleh <@${interaction.user.id}>.`
            )
            .setColor(0x00c853)
        ]
      });

      return interaction.reply({
        content:
          "✅ Order berhasil ditandai sebagai selesai.",
        ephemeral: true
      });
    }

    // ==========================================
    // REJECT PAYMENT
    // ==========================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "reject_"
      )
    ) {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content:
            "❌ Hanya MAMIYU STAFF yang dapat menolak pembayaran.",
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
        `**Staff:** <@${interaction.user.id}>\n\n` +
        `Pembayaran ditolak oleh staff.`,
        0xff0000
      );

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "❌ PEMBAYARAN DITOLAK"
            )
            .setDescription(
              `Pembayaran untuk **${orderId}** ditolak oleh <@${interaction.user.id}>.\n\n` +
              "Silakan hubungi staff untuk informasi lebih lanjut."
            )
            .setColor(0xff0000)
        ]
      });

      return interaction.reply({
        content:
          "❌ Pembayaran telah ditolak.",
        ephemeral: true
      });
    }

    // ==========================================
    // CLOSE ORDER
    // ==========================================

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
        "🔒 ORDER CLOSED",
        `**Order:** ${orderId}\n` +
        `**Closed by:** <@${interaction.user.id}>`
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
      "================ ERROR ================"
    );

    console.error(error);

    console.error(
      "========================================"
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

// =========================
// LOGIN
// =========================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN tidak ditemukan!"
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
