// 常量定义
const REQUIRED_SONG_FILES = {
    base_cover: "base.jpg",
    base_audio: "base.ogg", 
    song_config: "slst.txt"
};
const DIFF_MAPPING = { 0: "Past", 1: "Present", 2: "Future", 3: "Beyond", 4: "Eternal" };

// 全局状态
let currentSongTitle = "ARC_Song";
let songlistJson = {};
let songBasePath = ""; // 存储歌曲文件所在的基路径

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    setupEventListeners();
});

// 更新当前时间显示
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    document.getElementById('currentTime').textContent = `[${timeString}]`;
}

// 设置事件监听器
function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    // 文件选择事件
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const userId = document.getElementById('userId').value || 'Unknown_User';
            addLog('info', `开始处理文件: ${e.target.files[0].name}`);
            processZipFile(e.target.files[0], userId);
        }
    });

    // 拖拽事件
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.zip')) {
                const userId = document.getElementById('userId').value || 'Unknown_User';
                addLog('info', `开始处理拖拽文件: ${file.name}`);
                processZipFile(file, userId);
            } else {
                addLog('error', '请上传ZIP格式的文件');
            }
        }
    });

    // 用户ID输入变化时记录
    document.getElementById('userId').addEventListener('input', function(e) {
        if (e.target.value.trim()) {
            addLog('info', `用户ID已更新: ${e.target.value}`);
        }
    });
}

// 添加日志
function addLog(type, message) {
    const logsContainer = document.getElementById('logsContainer');
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-time">[${timeString}]</span>
        <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 清空日志
function clearLogs() {
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML = '';
    addLog('info', '日志已清空');
}
// 更新进度
function updateProgress(percent, text) {
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    
    progressText.textContent = text || `${percent}%`;
    progressBar.value = percent;
    
    // 显示进度区域
    document.getElementById('progressSection').classList.remove('hidden');
}

// 显示错误
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorContent = document.getElementById('errorContent');
    
    errorContent.textContent = message;
    errorSection.classList.remove('hidden');
    document.getElementById('resultSection').classList.add('hidden');
    
    addLog('error', message);
}

// 显示成功结果
function showSuccess(message, downloadUrl, fileName) {
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.innerHTML = `
        <p>${message}</p>
        <div style="margin-top: 15px;">
            <a href="${downloadUrl}" download="${fileName}" class="download-btn">
                📥 下载 ${fileName}
            </a>
        </div>
        <p style="margin-top: 15px; color: #7f8c8d;">
            文件大小: ${(downloadUrl.size / 1024 / 1024).toFixed(2)}MB
        </p>
    `;
    
    resultSection.classList.remove('hidden');
    document.getElementById('errorSection').classList.add('hidden');
    
    addLog('success', `打包完成: ${fileName}`);
}

// 检查文件路径是否在跳过列表中（以_开头的文件夹）
function shouldSkipPath(filePath) {
    if (!filePath) return false;
    
    // 将路径分割为目录部分
    const pathParts = filePath.split('/');
    
    // 检查每个目录部分是否以_开头
    for (const part of pathParts) {
        if (part.startsWith('_') && part.length > 1) {
            return true;
        }
    }
    
    return false;
}

// 解压ZIP文件
async function unzipSongPackage(zipBuffer) {
    updateProgress(10, "解压ZIP文件中...");
    addLog('info', '开始解压ZIP文件...');
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipBuffer);
    const files = {};
    
    // 读取所有文件到内存，跳过_开头的文件夹
    const fileEntries = Object.entries(zipContent.files);
    let fileCount = 0;
    let skippedCount = 0;
    
    for (const [filePath, file] of fileEntries) {
        if (file.dir) continue;
        
        // 跳过_开头的文件夹中的文件
        if (shouldSkipPath(filePath)) {
            skippedCount++;
            addLog('info', `跳过文件: ${filePath} (位于_开头文件夹中)`);
            continue;
        }
        
        // 只处理需要的文件类型
        if (filePath.endsWith('.aff') || 
            filePath.includes('base.jpg') || 
            filePath.includes('base.ogg') || 
            filePath.includes('slst.txt')) {
            
            const fileData = await file.async('uint8array');
            files[filePath] = fileData;
            fileCount++;
            
            addLog('info', `读取文件: ${filePath} (${(fileData.length / 1024).toFixed(1)}KB)`);
        }
    }
    
    addLog('success', `ZIP解压完成，共读取 ${fileCount} 个文件，跳过 ${skippedCount} 个文件`);
    return files;
}

// 在文件映射中查找必需的文件
function findRequiredFiles(files) {
    const result = {
        base_cover: null,
        base_audio: null,
        song_config: null,
        affFiles: []
    };
    
    // 首先尝试在根目录查找
    for (const [filePath, fileData] of Object.entries(files)) {
        const fileName = filePath.split('/').pop(); // 获取文件名
        
        if (fileName === 'base.jpg' && !result.base_cover) {
            result.base_cover = { path: filePath, data: fileData };
        } else if (fileName === 'base.ogg' && !result.base_audio) {
            result.base_audio = { path: filePath, data: fileData };
        } else if (fileName === 'slst.txt' && !result.song_config) {
            result.song_config = { path: filePath, data: fileData };
        } else if (fileName.endsWith('.aff')) {
            result.affFiles.push({ path: filePath, data: fileData });
        }
    }
    
    // 如果根目录没找到，尝试在所有文件夹中查找
    if (!result.base_cover || !result.base_audio || !result.song_config) {
        addLog('warning', '根目录未找到所有必需文件，开始在子文件夹中搜索...');
        
        for (const [filePath, fileData] of Object.entries(files)) {
            const fileName = filePath.split('/').pop();
            
            if (fileName === 'base.jpg' && !result.base_cover) {
                result.base_cover = { path: filePath, data: fileData };
                addLog('info', `在子文件夹中找到: base.jpg (${filePath})`);
            } else if (fileName === 'base.ogg' && !result.base_audio) {
                result.base_audio = { path: filePath, data: fileData };
                addLog('info', `在子文件夹中找到: base.ogg (${filePath})`);
            } else if (fileName === 'slst.txt' && !result.song_config) {
                result.song_config = { path: filePath, data: fileData };
                addLog('info', `在子文件夹中找到: slst.txt (${filePath})`);
            }
        }
    }
        // 确定歌曲基路径（大多数文件所在的目录）
    if (result.base_cover && result.base_audio && result.song_config) {
        const paths = [
            result.base_cover.path,
            result.base_audio.path, 
            result.song_config.path
        ];
        
        // 找到共同的路径前缀
        const commonPath = findCommonPath(paths);
        songBasePath = commonPath;
        addLog('info', `确定歌曲基路径: ${songBasePath || '根目录'}`);
    }
    
    return result;
}

// 找到多个路径的共同前缀
function findCommonPath(paths) {
    if (paths.length === 0) return '';
    
    // 分割路径为目录数组
    const pathArrays = paths.map(path => path.split('/').filter(part => part !== ''));
    
    // 找到最短的路径长度
    const minLength = Math.min(...pathArrays.map(arr => arr.length));
    
    let commonParts = [];
    
    // 逐级比较
    for (let i = 0; i < minLength; i++) {
        const currentPart = pathArrays[0][i];
        const allSame = pathArrays.every(arr => arr[i] === currentPart);
        
        if (allSame) {
            commonParts.push(currentPart);
        } else {
            break;
        }
    }
    
    return commonParts.length > 0 ? commonParts.join('/') + '/' : '';
}

// 从文件数据中获取歌曲信息
async function getSongInfoFromFiles(files) {
    updateProgress(30, "解析歌曲配置...");
    addLog('info', '开始解析歌曲配置...');
    
    // 查找必需文件
    const requiredFiles = findRequiredFiles(files);
    
    // 检查必需文件
    const missingFiles = [];
    if (!requiredFiles.base_cover) missingFiles.push('base.jpg');
    if (!requiredFiles.base_audio) missingFiles.push('base.ogg');
    if (!requiredFiles.song_config) missingFiles.push('slst.txt');
    
    if (missingFiles.length > 0) {
        addLog('error', `缺失必需文件: ${missingFiles.join(', ')}`);
        throw new Error(`缺失基础文件：${missingFiles.join(', ')}`);
    }

    addLog('info', '所有必需文件检查通过');

    // 解析slst配置
    try {
        const slstData = requiredFiles.song_config.data;
        const slstText = new TextDecoder().decode(slstData);
        const songInfo = JSON.parse(slstText);
        const finalSongInfo = songInfo.songs && Array.isArray(songInfo.songs) ? songInfo.songs[0] : songInfo;

        addLog('info', 'SLST配置文件解析成功');

        // 提取歌曲名称
        if (finalSongInfo.title_localized?.en) {
            currentSongTitle = finalSongInfo.title_localized.en.replace(/[\\/:*?"<>|]/g, "_");
            addLog('info', `歌曲名称: ${finalSongInfo.title_localized.en}`);
        } else if (finalSongInfo.title) {
            currentSongTitle = finalSongInfo.title.replace(/[\\/:*?"<>|]/g, "_");
            addLog('info', `歌曲名称: ${finalSongInfo.title}`);
        } else {
            addLog('warning', '未找到歌曲名称，使用默认名称');
        }

        // 收集难度文件
        finalSongInfo.difficulties = [];
        
        for (const affFile of requiredFiles.affFiles) {
            const fileName = affFile.path.split('/').pop();
            const diff = parseInt(fileName.replace('.aff', ''));
            if (!isNaN(diff) && diff >= 0 && diff <= 4) {
                finalSongInfo.difficulties.push(diff);
                addLog('info', `找到难度文件: ${fileName} (${DIFF_MAPPING[diff]})`);
            } else {
                addLog('warning', `忽略无效难度文件: ${fileName}`);
            }
        }

        if (finalSongInfo.difficulties.length === 0) {
            throw new Error('未找到有效的.aff谱面文件');
        }

        addLog('success', `共找到 ${finalSongInfo.difficulties.length} 个难度`);
        return finalSongInfo;

    } catch (error) {
        addLog('error', `SLST配置文件解析失败: ${error.message}`);
        throw new Error(`SLST配置文件格式错误: ${error.message}`);
    }
}
// 创建根配置文件
async function createRootConfigFiles(files, songInfo, userId) {
    updateProgress(50, "生成配置文件...");
    addLog('info', '开始生成配置文件...');
    
    const SAMPLE_SONGS = { 'root_song': songInfo };
    const packIds = new Set([songInfo.set || "pack001"]);

    // 生成packlist
    const packlistData = {
        packs: Array.from(packIds).map(pid => ({
            id: pid,
            name_localized: { en: `Pack ${pid}` }
        }))
    };
    files['packlist'] = new TextEncoder().encode(JSON.stringify(packlistData, null, 2));
    addLog('info', `生成packlist: ${Array.from(packIds).join(', ')}`);

    // 生成songlist
    const songlistData = { songs: [] };
    for (const [folderName, songInfoItem] of Object.entries(SAMPLE_SONGS)) {
        const processedSong = {
            id: songInfoItem.id || folderName,
            title_localized: songInfoItem.title_localized || { en: currentSongTitle },
            artist: songInfoItem.artist || "Unknown Artist",
            side: songInfoItem.side || 0,
            bpm: songInfoItem.bpm || "200",
            bpm_base: songInfoItem.bpm_base || 200.0,
            set: songInfoItem.set || "pack001",
            difficulties: songInfoItem.difficulties.map(diff => ({
                chartDesigner: typeof diff === 'object' ? (diff.chartDesigner || userId) : userId,
                rating: typeof diff === 'object' ? (diff.rating || -1) : -1,
                ratingPlus: typeof diff === 'object' ? (diff.ratingPlus || false) : false,
                ratingClass: typeof diff === 'object' ? diff.ratingClass : diff
            }))
        };
        songlistData.songs.push(processedSong);
    }
    
    files['songlist'] = new TextEncoder().encode(JSON.stringify(songlistData, null, 2));
    songlistJson = songlistData;
    
    addLog('success', `生成songlist完成，包含 ${songlistData.songs.length} 首歌曲`);
    return { packlistData, songlistData };
}

// 生成project.arcproj文件
async function generateProjectFile(files, songInfo, userId) {
    updateProgress(70, "生成ARC项目文件...");
    addLog('info', '开始生成ARC项目文件...');
    
    const song = songlistJson.songs[0];
    const res = { charts: [] };
    let validCharts = 0;

    for (const chart of song.difficulties) {
        const diff = chart.ratingClass;
        const chartFile = `${diff}.aff`;
        const difficultyName = DIFF_MAPPING[diff] || `未知${diff}`;
        
        // 查找对应的aff文件
        let affData = null;
        for (const [filePath, fileData] of Object.entries(files)) {
            const fileName = filePath.split('/').pop();
            if (fileName === chartFile) {
                affData = fileData;
                break;
            }
        }
        
        if (!affData) {
            addLog('warning', `跳过难度 ${difficultyName}: 缺失文件 ${chartFile}`);
            continue;
        }

        const diffColors = ['#3A6B78FF', '#566947FF', '#482B54FF', '#7C1C30FF', '#433455FF'];
        const difficultyText = chart.rating !== -1
            ? `${difficultyName} ${chart.rating}${chart.ratingPlus ? '+' : ''}`
            : difficultyName;

        res.charts.push({
            chartPath: chartFile,
            audioPath: "base.ogg",
            jacketPath: "base.jpg",
            baseBpm: song.bpm_base,
            bpmText: song.bpm,
            syncBaseBpm: true,
            title: song.title_localized.en,
            composer: song.artist,
            charter: chart.chartDesigner,
            difficulty: difficultyText,
            difficultyColor: diffColors[diff] || '#000000FF',
            skin: { side: ['light', 'conflict', 'colorless'][song.side] },
            previewEnd: song.audioPreviewEnd || 50400
        });

        validCharts++;
        addLog('info', `添加难度: ${difficultyText}`);
    }

    if (res.charts.length > 0) {
        const yamlData = jsyaml.dump(res, { encoding: "utf-8" });
        files['project.arcproj'] = new TextEncoder().encode(yamlData);
        addLog('success', `生成project.arcproj，包含 ${validCharts} 个有效难度`);
    } else {
        throw new Error('未生成project.arcproj：无有效难度');
    }
}

// 创建ARCpkg包
async function createARCpkg(files, userId) {
    updateProgress(90, "创建ARCpkg包...");
    addLog('info', '开始创建ARCpkg包...');
    
    const zip = new JSZip();
    const packId = songlistJson.songs[0]?.set || "pack001";
    const songId = songlistJson.songs[0]?.id || "root_song";
    
    addLog('info', `曲包ID: ${packId}, 歌曲ID: ${songId}`);

    // 创建索引文件
    const indexYml = [];

    // 添加曲包配置
    const packDir = zip.folder(packId);
    const packYml = {
        packName: `Pack ${packId}`,
        imagePath: `1080_select_${packId}.png`,
        levelIdentifiers: [`${userId}.${songId}`]
    };
    packDir.file(`${packId}.yml`, jsyaml.dump(packYml));
    addLog('info', `创建曲包配置: ${packId}.yml`);
    
    // 添加曲包封面（使用base.jpg）
    let coverFound = false;
    for (const [filePath, fileData] of Object.entries(files)) {
        const fileName = filePath.split('/').pop();
        if (fileName === 'base.jpg') {
            packDir.file(`1080_select_${packId}.png`, fileData);
            addLog('info', '添加曲包封面');
            coverFound = true;
            break;
        }
    }
    
    if (!coverFound) {
        addLog('warning', '未找到base.jpg，曲包将使用默认封面');
    }

    indexYml.push({
        directory: packId,
        identifier: `${userId}.${packId}`,
        settingsFile: `${packId}.yml`,
        version: 0,
        type: "pack"
    });

    // 添加歌曲文件
    const songDir = zip.folder(songId);
    const requiredFileNames = [
        "base.jpg", "base.ogg", "slst.txt", "project.arcproj",
        ...songlistJson.songs[0].difficulties.map(d => `${d.ratingClass}.aff`)
    ];
    
    let copiedFiles = 0;
    for (const requiredFileName of requiredFileNames) {
        let fileFound = false;
        
        // 在文件映射中查找对应的文件
        for (const [filePath, fileData] of Object.entries(files)) {
            const fileName = filePath.split('/').pop();
            if (fileName === requiredFileName) {
                songDir.file(requiredFileName, fileData);
                copiedFiles++;
                fileFound = true;
                break;
            }
        }
        
        if (!fileFound && requiredFileName !== 'project.arcproj') {
            addLog('warning', `缺失文件: ${requiredFileName}`);
        }
    }
    
    // 添加project.arcproj（这个文件是我们生成的）
    if (files['project.arcproj']) {
        songDir.file('project.arcproj', files['project.arcproj']);
        copiedFiles++;
    }
    
    addLog('info', `复制了 ${copiedFiles} 个文件到歌曲目录`);

    indexYml.push({
        directory: songId,
        identifier: `${userId}.${songId}`,
        settingsFile: "project.arcproj",
        version: 0,
        type: "level"
    });

    // 添加索引文件
    zip.file("index.yml", jsyaml.dump(indexYml));
    addLog('info', '创建索引文件: index.yml');

    // 生成ZIP文件
    addLog('info', '正在压缩文件...');
    const arcpkgBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
    });

    // 为blob添加size属性以便显示文件大小
    arcpkgBlob.size = arcpkgBlob.size;
    
    addLog('success', `ARCpkg创建完成，大小: ${(arcpkgBlob.size / 1024 / 1024).toFixed(2)}MB`);
    return arcpkgBlob;
}

// 主处理函数
async function processZipFile(file, userId) {
    try {
        // 重置界面状态
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('errorSection').classList.add('hidden');
        document.getElementById('resultSection').classList.add('hidden');
        
        // 重置全局状态
        songBasePath = "";
        
        addLog('info', `开始处理文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        addLog('info', `使用用户ID: ${userId}`);

        // 读取文件
        const arrayBuffer = await file.arrayBuffer();
        
        // 解压
        const files = await unzipSongPackage(arrayBuffer);
        
        // 解析歌曲信息
        const songInfo = await getSongInfoFromFiles(files);
        
        // 创建配置文件
        await createRootConfigFiles(files, songInfo, userId);
        
        // 生成project文件
        await generateProjectFile(files, songInfo, userId);
        
        // 创建ARCpkg
        const arcpkgBlob = await createARCpkg(files, userId);
        
        // 创建下载链接
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `${currentSongTitle}_${timestamp}.arcpkg`;
        const downloadUrl = URL.createObjectURL(arcpkgBlob);
        
        updateProgress(100, "完成!");
        
        // 显示结果
        showSuccess("🎉 打包成功！", downloadUrl, fileName);
        
    } catch (error) {
        updateProgress(0, "处理失败");
        showError(`打包失败：${error.message}`);
        console.error('处理错误:', error);
    }
        }
