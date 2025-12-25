const { Client, Collection, GatewayIntentBits, REST, Routes, Events } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config()

// 클라이언트 객체 생성 (Guilds관련, 메시지관련 인텐트 추가)
const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

client.commands = new Collection();

// commands 폴더에서 .js 파일들만 찾아서 불러오기
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsData = []; 

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // 불러온 파일이 형식을 잘 갖췄는지 확인 후 컬렉션에 추가
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
    } else {
        console.log(`[경고] ${filePath} 파일에 data 또는 execute 속성이 없습니다.`);
    }
}

// 봇이 준비됐을때 한번만(once) 표시할 메시지
client.once(Events.ClientReady, async () => {
    console.log(`로그인 성공: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`${commandsData.length}개의 명령어를 등록(새로고침)합니다.`);
        // 여기서는 테스트를 위해 전역(applicationCommands)으로 등록합니다.
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData },
        );
        console.log('명령어 등록 완료!');
    } catch (error) {
        console.error(error);
    }
});

// 상호작용(Interaction) 처리 핸들러
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // 입력된 명령어 이름으로 컬렉션에서 해당 코드를 찾음
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName} 명령어를 찾을 수 없습니다.`);
        return;
    }

    try {
        // 찾은 명령어 파일의 execute 함수 실행
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const errorMsg = { content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg);
        } else {
            await interaction.reply(errorMsg);
        }
    }
});

// 4. 누군가 ping을 작성하면 pong으로 답장한다.
client.on('messageCreate', (message) => {
    if(message.content == 'ping'){
        message.reply('pong');
    }
})



// 시크릿키(토큰)을 통해 봇 로그인 실행
client.login(process.env.DISCORD_TOKEN);