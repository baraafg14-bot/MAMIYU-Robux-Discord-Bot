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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

function money(n) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function makeId() {
  return "RBX-" + Math.random().toString(36).slice(2, 7).toUpperCase() + "-" + Date.now().toString().slice(-4);
}

function staffOnly(member) {
  return member.roles.cache.has(config.roles.staff);
}

async function sendLog(guild, title, description) {
  const id = config.channels.orderLogs;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch) return;
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x8b2cff)
        .setTimestamp()
    ]
  }).catch(() => {});
}

client.once("ready", () => {
  console.log(`MAMIYU BOT online sebagai ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "❌ Hanya administrator yang dapat menjalankan setup.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;

        let staffRole = guild.roles.cache.find(r => r.name === "MAMIYU STAFF");
        if (!staffRole) {
          staffRole = await guild.roles.create({
            name: "MAMIYU STAFF",
            color: 0x8b2cff,
            reason: "MAMIYU Store setup"
          });
        }
        config.roles.staff = staffRole.id;

        const findOrCreateCategory = async (name) => {
          let c = guild.channels.cache.find(x => x.type === ChannelType.GuildCategory && x.name === name);
          if (!c) c = await guild.channels.create({ name, type: ChannelType.GuildCategory });
          return c;
        };

        const findOrCreateText = async (name, parent, opts={}) => {
          let c = guild.channels.cache.find(x => x.type === ChannelType.GuildText && x.name === name);
          if (!c) c = await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent,
            ...opts
          });
          return c;
        };

        const info = await findOrCreateCategory("📌 INFORMATION");
        const store = await findOrCreateCategory("🛒 ROBUX STORE");
        const orders = await findOrCreateCategory("🎫 ORDERS");
        const staff = await findOrCreateCategory("🔐 STAFF");

        const announcement = await findOrCreateText("📢・announcement", info);
        const rules = await findOrCreateText("📜・rules", info);
        const priceList = await findOrCreateText("💰・price-list", info);
        const createOrder = await findOrCreateText("🛍️・create-order", store);
        const testimonials = await findOrCreateText("⭐・testimonials", store);
        const orderLogs = await findOrCreateText("📋・order-logs", staff);
        const paymentLogs = await findOrCreateText("💳・payment-logs", staff);
        const staffChat = await findOrCreateText("🛠️・staff-chat", staff);

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

        fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

        const priceEmbed = new EmbedBuilder()
          .setTitle("💜 MAMIYU STORE — TOP UP ROBUX")
          .setDescription("Harga eceran Robux • Via Username\n\nPilih nominal melalui `/buy` untuk membuat order.")
          .setColor(0x8b2cff)
          .setFooter({ text: "MAMIYU STORE • Trusted • Fast • Safe" });

        const priceLines = Object.entries(config.prices)
          .map(([r, p]) => `**${money(r)} RBX** → **Rp ${money(p)}**`)
          .join("\n");
        priceEmbed.addFields({ name: "💎 PRICE LIST", value: priceLines.slice(0, 1024) });

        await priceList.send({ embeds: [priceEmbed] }).catch(() => {});

        const buyEmbed = new EmbedBuilder()
          .setTitle("🛒 MAMIYU ROBUX STORE")
          .setDescription(
            "Butuh Robux? Buat order langsung di sini.\n\n" +
            "⚡ Proses cepat\n🔒 Aman & terpercaya\n💜 Pelayanan ramah\n\n" +
            "Klik tombol **BUY ROBUX** untuk mulai."
          )
          .setColor(0x8b2cff);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("buy_robux")
            .setLabel("BUY ROBUX")
            .setEmoji("🛒")
            .setStyle(ButtonStyle.Primary)
        );

        await createOrder.send({ embeds: [buyEmbed], components: [row] }).catch(() => {});

        await interaction.editReply("✅ Setup MAMIYU Store selesai. Silakan jalankan `/buy` untuk menguji order.");
      }

      if (interaction.commandName === "price") {
        const lines = Object.entries(config.prices)
          .map(([r, p]) => `**${money(r)} RBX** → **Rp ${money(p)}**`)
          .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("💜 MAMIYU STORE — PRICE LIST")
              .setDescription(lines)
              .setColor(0x8b2cff)
              .setFooter({ text: "Via Username • MAMIYU STORE" })
          ]
        });
      }

      if (interaction.commandName === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("robux_amount")
          .setPlaceholder("Pilih nominal Robux...")
          .addOptions(
            Object.entries(config.prices).map(([r, p]) => ({
              label: `${money(r)} Robux`,
              description: `Rp ${money(p)}`,
              value: r
            }))
          );

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🛒 MAMIYU ROBUX STORE")
              .setDescription("Pilih nominal Robux yang ingin kamu beli.")
              .setColor(0x8b2cff)
          ],
          components: [new ActionRowBuilder().addComponents(menu)],
          ephemeral: true
        });
      }
    }

    if (interaction.isButton() && interaction.customId === "buy_robux") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("robux_amount")
        .setPlaceholder("Pilih nominal Robux...")
        .addOptions(
          Object.entries(config.prices).map(([r, p]) => ({
            label: `${money(r)} Robux`,
            description: `Rp ${money(p)}`,
            value: r
          }))
        );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💜 PILIH NOMINAL")
            .setDescription("Pilih jumlah Robux yang ingin kamu order.")
            .setColor(0x8b2cff)
        ],
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "robux_amount") {
      const amount = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`order_modal_${amount}`)
        .setTitle("MAMIYU • Data Order");

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

    if (interaction.isModalSubmit() && interaction.customId.startsWith("order_modal_")) {
      const amount = interaction.customId.replace("order_modal_", "");
      const username = interaction.fields.getTextInputValue("roblox_username");
      const notes = interaction.fields.getTextInputValue("notes") || "-";
      const price = config.prices[amount];
      const orderId = makeId();

      const category = await interaction.guild.channels.fetch(config.channels.ordersCategory).catch(() => null);
      if (!category) {
        return interaction.reply({ content: "❌ Category order belum dibuat. Jalankan `/setup`.", ephemeral: true });
      }

      const channel = await interaction.guild.channels.create({
        name: `order-${orderId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
          { id: config.roles.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      const paymentButtons = new ActionRowBuilder().addComponents(
        ...config.paymentMethods.map((method, i) =>
          new ButtonBuilder()
            .setCustomId(`pay_${orderId}_${method.replace(/\s/g, "_")}`)
            .setLabel(method)
            .setStyle(i === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        )
      );

      const embed = new EmbedBuilder()
        .setTitle(`🛒 ORDER ${orderId}`)
        .setDescription("Silakan pilih metode pembayaran di bawah.")
        .addFields(
          { name: "👤 Customer", value: `<@${interaction.user.id}>`, inline: true },
          { name: "🎮 Roblox Username", value: `\`${username}\``, inline: true },
          { name: "💎 Product", value: `**${money(amount)} Robux**`, inline: true },
          { name: "💰 Total", value: `**Rp ${money(price)}**`, inline: true },
          { name: "📝 Catatan", value: notes, inline: false },
          { name: "📌 Status", value: "🟡 WAITING PAYMENT", inline: true }
        )
        .setColor(0x8b2cff)
        .setFooter({ text: "MAMIYU STORE • Jangan kirim password Roblox kepada siapa pun." });

      await channel.send({
        content: `<@${interaction.user.id}> <@&${config.roles.staff}>`,
        embeds: [embed],
        components: [paymentButtons]
      });

      await sendLog(
        interaction.guild,
        "🆕 NEW ORDER",
        `**Order:** ${orderId}\n**Customer:** <@${interaction.user.id}>\n**Roblox:** \`${username}\`\n**Product:** ${amount} Robux\n**Total:** Rp ${money(price)}`
      );

      return interaction.reply({
        content: `✅ Order dibuat: <#${channel.id}>`,
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("pay_")) {
      const parts = interaction.customId.split("_");
      const orderId = parts[1];
      const method = parts.slice(2).join(" ");
      const account = config.paymentAccounts[method] || "Belum diatur oleh admin.";

      const row = new ActionRowBuilder().addComponents(
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
            .setTitle(`💳 PAYMENT • ${method}`)
            .setDescription(
              `Silakan lakukan pembayaran ke:\n\n**${account}**\n\n` +
              "Setelah membayar, kirim bukti pembayaran di channel order ini lalu klik **SAYA SUDAH BAYAR**."
            )
            .setColor(0x8b2cff)
        ],
        components: [row]
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("paid_")) {
      const orderId = interaction.customId.replace("paid_", "");

      // Mengirim embed notifikasi pembayaran ke channel order agar staff bisa melihat
      const staffEmbed = new EmbedBuilder()
        .setTitle(`💳 PAYMENT CLAIMED • ${orderId}`)
        .setDescription(`Customer <@${interaction.user.id}> telah mengonfirmasi pembayaran.\n\nMohon segera dicek mutasi/pembayarannya oleh Staff!`)
        .setColor(0x00ff00)
        .setTimestamp();

      // Tombol khusus staff untuk menyelesaikan atau menutup order
      const staffActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`complete_${orderId}`)
          .setLabel("SELESAIKAN ORDER")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`close_${orderId}`)
          .setLabel("TUTUP ORDER")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({
        content: `<@&${config.roles.staff}> 🔔 Ada konfirmasi pembayaran baru!`,
        embeds: [staffEmbed],
        components: [staffActionRow]
      });

      await sendLog(
        interaction.guild,
        "💳 PAYMENT CLAIMED",
        `**Order:** ${orderId}\n**Customer:** <@${interaction.user.id}>\nCustomer menekan tombol **Saya Sudah Bayar**.`
      );

      return interaction.reply({
        content: `✅ Notifikasi pembayaran untuk **${orderId}** telah dikirim ke staff. Silakan tunggu verifikasi.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("complete_")) {
      const orderId = interaction.customId.replace("complete_", "");
      
      await interaction.reply("🎉 Order telah diselesaikan oleh Staff. Channel akan ditutup dalam 5 detik.");
      
      await sendLog(
        interaction.guild,
        "✅ ORDER COMPLETED",
        `**Order:** ${orderId}\n**Processed by:** <@${interaction.user.id}>`
      );

      setTimeout(async () => {
        await interaction.channel.delete(`Completed order ${orderId}`).catch(() => {});
      }, 5000);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("close_")) {
      const orderId = interaction.customId.replace("close_", "");
      await interaction.reply("🔒 Order akan ditutup dalam 5 detik.");
      setTimeout(async () => {
        await interaction.channel.delete(`Closed order ${orderId}`).catch(() => {});
      }, 5000);
      return;
    }
