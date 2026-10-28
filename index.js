require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder
} = require("discord.js");

const config = require("./config.json");
const TOKEN = process.env.DISCORD_TOKEN;
const QRIS_PATH = path.join(__dirname, "assets", "qris-entongstore.jpg");
const ORDERS_PATH = path.join(__dirname, "orders.json");

if (!TOKEN) {
  console.error("DISCORD_TOKEN belum diatur. Salin .env.example menjadi .env lalu isi token bot.");
  process.exit(1);
}
if (!fs.existsSync(QRIS_PATH)) {
  console.error("File QRIS tidak ditemukan:", QRIS_PATH);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

function loadOrders() {
  try {
    if (!fs.existsSync(ORDERS_PATH)) fs.writeFileSync(ORDERS_PATH, "{}");
    return JSON.parse(fs.readFileSync(ORDERS_PATH, "utf8"));
  } catch (error) {
    console.error("orders.json tidak bisa dibaca:", error);
    return {};
  }
}
function saveOrders(orders) {
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2));
}
let orders = loadOrders();

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value);

function staffRole(guild) {
  return guild.roles.cache.find(role => role.name === config.roles.staff) || null;
}
function isStaff(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.roles?.cache?.some(role => role.name === config.roles.staff));
}
function pricesDescription() {
  return Object.entries(config.robuxPrices)
    .map(([amount, price]) => `• **${Number(amount).toLocaleString("id-ID")} R$** — ${rupiah(price)}`)
    .join("\n");
}
function priceEmbed() {
  return new EmbedBuilder()
    .setColor(0x0788ff)
    .setTitle(`💎 ${config.storeName} • Daftar Harga Robux`)
    .setDescription(pricesDescription())
    .addFields({ name: "💳 Pembayaran", value: "QRIS", inline: true },
      { name: "🛡️ Proses", value: "Pembayaran diverifikasi staff", inline: true })
    .setFooter({ text: `${config.storeName} • Pastikan nominal benar sebelum membayar` })
    .setTimestamp();
}
function orderEmbed(order) {
  return new EmbedBuilder()
    .setColor(order.status === "completed" ? 0x22c55e : order.status === "cancelled" ? 0xef4444 : 0x0788ff)
    .setTitle(`🧾 Pesanan ${order.id}`)
    .addFields(
      { name: "Pembeli", value: `<@${order.userId}>`, inline: true },
      { name: "Paket", value: `${Number(order.robux).toLocaleString("id-ID")} R$`, inline: true },
      { name: "Total", value: rupiah(order.price), inline: true },
      { name: "Metode pembayaran", value: "QRIS", inline: true },
      { name: "Status", value: order.status, inline: true }
    )
    .setTimestamp();
}
function qrisAttachment() {
  return new AttachmentBuilder(QRIS_PATH, { name: "qris-entongstore.jpg" });
}
function paymentRow(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`paid:${orderId}`).setLabel("Saya Sudah Bayar").setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId(`cancel:${orderId}`).setLabel("Batalkan Pesanan").setStyle(ButtonStyle.Danger).setEmoji("✖️")
  );
}
function staffRow(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verify:${orderId}`).setLabel("Verifikasi & Selesaikan").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`staffcancel:${orderId}`).setLabel("Batalkan").setStyle(ButtonStyle.Danger)
  );
}
async function getOrCreateRole(guild) {
  let role = staffRole(guild);
  if (!role) role = await guild.roles.create({ name: config.roles.staff, color: 0x0788ff, reason: "Role staff EntongStore" });
  return role;
}
async function sendLog(guild, message) {
  const logChannel = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText && channel.name === config.channels.orderLog);
  if (logChannel) await logChannel.send({ content: message }).catch(() => {});
}
async function createOrder(interaction) {
  const guild = interaction.guild;
  const existing = Object.values(orders).find(order =>
    order.guildId === guild.id && order.userId === interaction.user.id &&
    !["completed", "cancelled"].includes(order.status));
  if (existing) {
    const channel = guild.channels.cache.get(existing.channelId);
    if (channel) {
      await interaction.reply({ content: `Kamu masih memiliki pesanan aktif: ${channel}`, ephemeral: true });
      return;
    }
    existing.status = "cancelled";
    saveOrders(orders);
  }

  let category = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && channel.name === config.channels.category);
  if (!category) category = await guild.channels.create({ name: config.channels.category, type: ChannelType.GuildCategory });

  const role = await getOrCreateRole(guild);
  const channelName = `order-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const channel = await guild.channels.create({
    name: channelName || `order-${interaction.user.id}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageChannels] }
    ]
  });

  const id = `${Date.now().toString(36)}-${interaction.user.id.slice(-4)}`;
  const order = {
    id, guildId: guild.id, channelId: channel.id, userId: interaction.user.id,
    robux: null, price: null, status: "choosing_package", createdAt: new Date().toISOString()
  };
  orders[id] = order;
  saveOrders(orders);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`package:${id}`)
    .setPlaceholder("Pilih paket Robux")
    .addOptions(Object.entries(config.robuxPrices).map(([amount, price]) => ({
      label: `${Number(amount).toLocaleString("id-ID")} Robux`,
      description: rupiah(price),
      value: amount
    })));
  await channel.send({
    content: `<@${interaction.user.id}> selamat datang di **${config.storeName}**!\nPilih paket Robux pada menu di bawah. Staff tidak akan meminta password akunmu.`,
    embeds: [priceEmbed()],
    components: [new ActionRowBuilder().addComponents(select)]
  });
  await interaction.reply({ content: `Tiket pesanan kamu sudah dibuat: ${channel}`, ephemeral: true });
}

client.once("ready", () => {
  console.log(`Bot ${client.user.tag} aktif untuk ${config.storeName}.`);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "price") {
        await interaction.reply({ embeds: [priceEmbed()], ephemeral: true });
        return;
      }
      if (interaction.commandName === "buy") {
        await createOrder(interaction);
        return;
      }
      if (interaction.commandName === "setup") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "Command ini hanya untuk administrator.", ephemeral: true });
          return;
        }
        await getOrCreateRole(interaction.guild);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("buy:start").setLabel("Buat Pesanan").setStyle(ButtonStyle.Primary).setEmoji("🛒")
        );
        await interaction.channel.send({
          embeds: [new EmbedBuilder().setColor(0x0788ff)
            .setTitle(`💎 ${config.storeName} • Top Up Robux`)
            .setDescription(`Selamat datang di **${config.storeName}**!\n\n${pricesDescription()}\n\n**Pembayaran hanya melalui QRIS.** Klik tombol di bawah untuk membuat tiket pesanan.`)
            .setImage("attachment://qris-entongstore.jpg")
            .setFooter({ text: "Jangan membagikan password akun kepada siapa pun." })],
          files: [qrisAttachment()],
          components: [row]
        });
        await interaction.reply({ content: "Panel EntongStore berhasil dipasang.", ephemeral: true });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === "buy:start") {
      await createOrder(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("package:")) {
      const id = interaction.customId.split(":")[1];
      const order = orders[id];
      if (!order || order.userId !== interaction.user.id) {
        await interaction.reply({ content: "Pesanan tidak ditemukan atau bukan milikmu.", ephemeral: true });
        return;
      }
      if (order.status !== "choosing_package") {
        await interaction.reply({ content: "Paket pesanan ini sudah dipilih sebelumnya.", ephemeral: true });
        return;
      }
      const amount = interaction.values[0];
      order.robux = Number(amount);
      order.price = config.robuxPrices[amount];
      order.status = "awaiting_payment";
      saveOrders(orders);

      const embed = new EmbedBuilder()
        .setColor(0x0788ff)
        .setTitle(`💳 Pembayaran QRIS • ${config.storeName}`)
        .setDescription(`Pesanan: **${Number(amount).toLocaleString("id-ID")} R$**\nTotal: **${rupiah(order.price)}**\n\n${config.payment.instructions.map((line, i) => `${i + 1}. ${line}`).join("\n")}`)
        .setImage("attachment://qris-entongstore.jpg")
        .setFooter({ text: "QRIS pada gambar harus diverifikasi sebelum pesanan diproses." });
      await interaction.update({ content: "Paket dipilih. Ikuti instruksi pembayaran di bawah.", components: [] });
      await interaction.channel.send({ embeds: [embed], files: [qrisAttachment()], components: [paymentRow(id)] });
      await sendLog(interaction.guild, `🆕 Pesanan ${id} dibuat oleh ${interaction.user.tag}: ${amount} R$ — ${rupiah(order.price)} — <#${order.channelId}>`);
      return;
    }

    if (interaction.isButton()) {
      const [action, id] = interaction.customId.split(":");
      if (!id || !["paid", "cancel", "verify", "staffcancel"].includes(action)) return;
      const order = orders[id];
      if (!order) {
        await interaction.reply({ content: "Data pesanan tidak ditemukan.", ephemeral: true });
        return;
      }

      if (action === "paid") {
        if (interaction.user.id !== order.userId) {
          await interaction.reply({ content: "Hanya pembeli yang dapat menandai pembayaran.", ephemeral: true });
          return;
        }
        if (order.status !== "awaiting_payment") {
          await interaction.reply({ content: "Status pesanan sudah berubah.", ephemeral: true });
          return;
        }
        order.status = "payment_claimed";
        order.paymentClaimedAt = new Date().toISOString();
        saveOrders(orders);
        await interaction.update({ components: [] });
        await interaction.channel.send({
          content: `🔔 <@&${staffRole(interaction.guild)?.id || ""}> Pembeli <@${order.userId}> menyatakan sudah membayar pesanan **${rupiah(order.price)}**. Periksa transaksi QRIS secara manual sebelum menyelesaikan pesanan.`,
          embeds: [orderEmbed(order)],
          components: [staffRow(id)]
        });
        await sendLog(interaction.guild, `🔔 Pembayaran diklaim untuk pesanan ${id}; perlu verifikasi manual.`);
        return;
      }

      if (!isStaff(interaction.member)) {
        await interaction.reply({ content: "Tombol ini hanya untuk staff EntongStore atau administrator.", ephemeral: true });
        return;
      }
      if (["completed", "cancelled"].includes(order.status)) {
        await interaction.reply({ content: "Pesanan ini sudah ditutup.", ephemeral: true });
        return;
      }

      if (action === "verify") {
        if (order.status !== "payment_claimed") {
          await interaction.reply({ content: "Pembeli belum menandai pembayaran. Verifikasi hanya setelah memeriksa transaksi.", ephemeral: true });
          return;
        }
        order.status = "completed";
        order.completedAt = new Date().toISOString();
        order.verifiedBy = interaction.user.id;
        saveOrders(orders);
        await interaction.update({ embeds: [orderEmbed(order)], components: [] });
        await interaction.channel.send(`✅ Pembayaran pesanan **${order.id}** telah diverifikasi oleh ${interaction.user}. Staff dapat melanjutkan pengiriman Robux.`);
        await sendLog(interaction.guild, `✅ Pesanan ${id} diselesaikan oleh ${interaction.user.tag}.`);
        return;
      }

      if (action === "cancel" && interaction.user.id !== order.userId) {
        await interaction.reply({ content: "Hanya pembeli yang dapat membatalkan pesanan ini.", ephemeral: true });
        return;
      }
      if (action === "staffcancel" && !isStaff(interaction.member)) {
        await interaction.reply({ content: "Hanya staff yang dapat membatalkan pesanan ini.", ephemeral: true });
        return;
      }
      order.status = "cancelled";
      order.cancelledAt = new Date().toISOString();
      saveOrders(orders);
      await interaction.update({ components: [] });
      await interaction.channel.send(`❌ Pesanan **${id}** dibatalkan oleh ${interaction.user}.`);
      await sendLog(interaction.guild, `❌ Pesanan ${id} dibatalkan oleh ${interaction.user.tag}.`);
    }
  } catch (error) {
    console.error("Kesalahan interaction:", error);
    const response = { content: "Terjadi kesalahan saat memproses permintaan. Cek log bot.", ephemeral: true };
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply(response).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.followUp(response).catch(() => {});
    }
  }
});

client.login(TOKEN);
