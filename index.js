
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TMDB = "https://api.themoviedb.org/3";
const REGION = "SA";
const POSTER = "https://image.tmdb.org/t/p/w500";

async function getMovies(path) {
  const response = await fetch(TMDB + path, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error("TMDB API Error: " + response.status);
  }

  return response.json();
}

function createEmbed(movie) {
  const embed = new EmbedBuilder()
    .setColor(0xD6A84B)
    .setTitle("🎬 " + movie.title)
    .setDescription(
      movie.overview || "لا يوجد وصف متاح."
    )
    .addFields(
      {
        name: "📅 تاريخ الإصدار",
        value: movie.release_date || "غير معروف",
        inline: true
      },
      {
        name: "⭐ التقييم",
        value: String(movie.vote_average ?? "غير متوفر"),
        inline: true
      }
    )
    .setFooter({ text: "A F S • MOVIE BOT" });

  if (movie.poster_path) {
    embed.setThumbnail(POSTER + movie.poster_path);
  }

  return embed;
}

const commands = [
  new SlashCommandBuilder()
    .setName("now")
    .setDescription("عرض الأفلام المعروضة حاليًا")
    .setNameLocalizations({ ar: "السينما" })
    .setDescriptionLocalizations({
      ar: "عرض الأفلام المعروضة حاليًا"
    }),

  new SlashCommandBuilder()
    .setName("search")
    .setDescription("البحث عن فيلم")
    .setNameLocalizations({ ar: "بحث" })
    .setDescriptionLocalizations({
      ar: "ابحث عن فيلم باسمه"
    })
    .addStringOption(option =>
      option.setName("name")
        .setDescription("اسم الفيلم")
        .setRequired(true)
        .setNameLocalizations({ ar: "الاسم" })
        .setDescriptionLocalizations({
          ar: "اكتب اسم الفيلم"
        })
    ),

  new SlashCommandBuilder()
    .setName("watch")
    .setDescription("منصات المشاهدة القانونية")
    .setNameLocalizations({ ar: "مشاهدة" })
    .setDescriptionLocalizations({
      ar: "البحث عن منصات المشاهدة القانونية"
    })
    .addStringOption(option =>
      option.setName("name")
        .setDescription("اسم الفيلم")
        .setRequired(true)
    )
].map(command => command.toJSON());

async function main() {
  const required = [
    "DISCORD_TOKEN",
    "CLIENT_ID",
    "GUILD_ID",
    "TMDB_TOKEN"
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error("Missing environment variable: " + key);
    }
  }

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  await client.login(process.env.DISCORD_TOKEN);
}

client.once("ready", () => {
  console.log("AFS MOVIE BOT is online!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  try {
    if (interaction.commandName === "now") {
      const data = await getMovies(
        `/movie/now_playing?language=ar-SA&region=${REGION}`
      );

      const movies = data.results.slice(0, 5);

      if (!movies.length) {
        return interaction.editReply("لا توجد أفلام متاحة.");
      }

      return interaction.editReply({
        content: "🎬 الأفلام المعروضة حاليًا:",
        embeds: movies.map(createEmbed)
      });
    }

    const name = interaction.options.getString("name");

    const search = await getMovies(
      `/search/movie?query=${encodeURIComponent(name)}&language=ar-SA`
    );

    const movie = search.results[0];

    if (!movie) {
      return interaction.editReply("لم يتم العثور على الفيلم.");
    }

    if (interaction.commandName === "search") {
      return interaction.editReply({
        embeds: [createEmbed(movie)]
      });
    }

    if (interaction.commandName === "watch") {
      const data = await getMovies(
        `/movie/${movie.id}/watch/providers`
      );

      const region = data.results?.[REGION];
      const providers = [
        ...(region?.flatrate || []),
        ...(region?.free || []),
        ...(region?.ads || [])
      ];

      const unique = [
        ...new Map(
          providers.map(p => [p.provider_id, p])
        ).values()
      ];

      const embed = createEmbed(movie);

      embed.addFields({
        name: "📺 منصات المشاهدة القانونية",
        value: unique.length
          ? unique.map(p => "• " + p.provider_name).join("\n")
          : "لا توجد منصات مسجلة لهذا الفيلم في منطقتك."
      });

      if (region?.link) {
        embed.addFields({
          name: "🔗 رابط المشاهدة",
          value: `[عرض المنصات الرسمية](${region.link})`
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error(error);
    return interaction.editReply(
      "حدث خطأ أثناء جلب بيانات الفيلم. حاول لاحقًا."
    );
  }
});

main().catch(console.error);
