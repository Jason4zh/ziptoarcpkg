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
// 批量处理状态管理
let isBatchProcessing = false; // 是否处于批量处理中
let totalBatchFiles = 0; // 批量处理的总文件数
let completedBatchFiles = 0; // 已完成处理的文件数

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

    // 文件选择事件（支持多文件）
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const userId = document.getElementById('userId').value || 'Unknown_User';
            const selectedFiles = Array.from(e.target.files);
            startBatchProcessing(selectedFiles, userId);
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
            const userId = document.getElementById('userId').value || 'Unknown_User';
            const zipFiles = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.zip'));
            if (zipFiles.length === 0) {
                addLog('error', '请上传ZIP格式的文件');
                return;
            }
            startBatchProcessing(zipFiles, userId);
        }
    });

    // 用户ID输入变化时记录
    document.getElementById('userId').addEventListener('input', function(e) {
        if (e.target.value.trim()) {
            addLog('info', `用户ID已更新: ${e.target.value}`);
        }
    });
}

// 启动批量处理
function startBatchProcessing(files, userId) {
    isBatchProcessing = true;
    totalBatchFiles = files.length;
    completedBatchFiles = 0;
    addLog('info', `=== 开始批量处理，共 ${totalBatchFiles} 个ZIP文件 ===`);

    document.getElementById('progressSection').classList.remove('hidden');
    updateProgress(0, `等待处理（0/${totalBatchFiles}）`);

    // 顺序处理每个文件，避免并发冲突
    (async () => {
        for (const file of files) {
            try {
                addLog('info', `\n--- 开始处理第 ${completedBatchFiles + 1}/${totalBatchFiles} 个文件：${file.name} ---`);
                await processZipFile(file, userId);
                completedBatchFiles++;
                const batchPercent = Math.round((completedBatchFiles / totalBatchFiles) * 100);
                updateProgress(batchPercent, `已完成 ${completedBatchFiles}/${totalBatchFiles} 个文件`);
            } catch (error) {
                completedBatchFiles++;
                const batchPercent = Math.round((completedBatchFiles / totalBatchFiles) * 100);
                updateProgress(batchPercent, `处理失败（${completedBatchFiles}/${totalBatchFiles}）`);
                addLog('error', `第 ${completedBatchFiles}/${totalBatchFiles} 个文件处理失败：${error.message}`);
            }
        }

        isBatchProcessing = false;
        const failedCount = totalBatchFiles - (completedBatchFiles - (totalBatchFiles - completedBatchFiles));
        addLog('success', `\n=== 批量处理结束！共处理 ${totalBatchFiles} 个文件，成功 ${completedBatchFiles - failedCount} 个，失败 ${failedCount} 个 ===`);
    })();
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
    document.getElementById('progressSection').classList.remove('hidden');
}

// 显示错误
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorContent = document.getElementById('errorContent');
    
    errorContent.textContent = message;
    errorSection.classList.remove('hidden');
    if (!isBatchProcessing) {
        document.getElementById('resultSection').classList.add('hidden');
    }
    
    addLog('error', message);
}

// 显示成功结果（批量时追加，单文件时覆盖）
function showSuccess(message, downloadUrl, fileName) {
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');
    
    const resultHtml = `
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #eee;">
            <p>${message}</p>
            <div style="margin-top: 15px;">
                <a href="${downloadUrl}" download="${fileName}" class="download-btn">
                    📥 下载 ${fileName}
                </a>
            </div>
            <p style="margin-top: 15px; color: #7f8c8d;">
                文件大小: ${(downloadUrl.size / 1024 / 1024).toFixed(2)}MB
            </p>
        </div>
    `;

    if (isBatchProcessing) {
        resultContent.innerHTML += resultHtml;
    } else {
        resultContent.innerHTML = resultHtml;
    }

    resultSection.classList.remove('hidden');
    document.getElementById('errorSection').classList.add('hidden');
    addLog('success', `打包完成: ${fileName}`);
}

// 解压ZIP文件（新增：跳过"_"开头的文件夹）
async function unzipSongPackage(zipBuffer) {
    updateProgress(isBatchProcessing ? null : 10, "解压ZIP文件中...");
    addLog('info', '开始解压ZIP文件...');
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipBuffer);
    const files = {};
    const fileEntries = Object.entries(zipContent.files);
    let fileCount = 0;
    
    for (const [fileName, file] of fileEntries) {
        if (file.dir) {
            const folderName = fileName.split('/')[0];
            if (folderName.startsWith('_')) {
                addLog('info', `跳过"_"开头的文件夹: ${folderName}/`);
            } else {
                addLog('info', `跳过普通文件夹: ${folderName}/`);
            }
            continue;
        }
        
        // 仅读取目标文件（.aff、base.jpg、base.ogg、slst.txt）
        if (fileName.endsWith('.aff') || 
            fileName === 'base.jpg' || 
            fileName === 'base.ogg' || 
            fileName === 'slst.txt') {
            
            const fileData = await file.async('uint8array');
            files[fileName] = fileData;
            fileCount++;
            addLog('info', `读取文件: ${fileName} (${(fileData.length / 1024).toFixed(1)}KB)`);
        }
    }
    
    addLog('success', `ZIP解压完成，共读取 ${fileCount} 个文件`);
    return files;
}


// 从文件数据中获取歌曲信息
async function getSongInfoFromFiles(files) {
    updateProgress(isBatchProcessing ? null : 30, "解析歌曲配置...");
    addLog('info', '开始解析歌曲配置...');
    
    const missingFiles = [];
    for (const fileName of Object.values(REQUIRED_SONG_FILES)) {
        if (!files[fileName]) {
            missingFiles.push(fileName);
            addLog('warning', `缺失必需文件: ${fileName}`);
        }
    }
    
    if (missingFiles.length > 0) {
        throw new Error(`缺失基础文件：${missingFiles.join(', ')}`);
    }
    addLog('info', '所有必需文件检查通过');
    
    try {
        const slstData = files[REQUIRED_SONG_FILES.song_config];
        const slstText = new TextDecoder().decode(slstData);
        const songInfo = JSON.parse(slstText);
        const finalSongInfo = songInfo.songs && Array.isArray(songInfo.songs) ? songInfo.songs[0] : songInfo;
        addLog('info', 'SLST配置文件解析成功');
        
        if (finalSongInfo.title_localized?.en) {
            currentSongTitle = finalSongInfo.title_localized.en.replace(/[\\/:*?"<>|]/g, "_");
            addLog('info', `歌曲名称: ${finalSongInfo.title_localized.en}`);
        } else if (finalSongInfo.title) {
            currentSongTitle = finalSongInfo.title.replace(/[\\/:*?"<>|]/g, "_");
            addLog('info', `歌曲名称: ${finalSongInfo.title}`);
        } else {
            addLog('warning', '未找到歌曲名称，使用默认名称');
        }
        
        finalSongInfo.difficulties = [];
        const affFiles = Object.keys(files).filter(name => name.endsWith('.aff'));
        
        for (const fileName of affFiles) {
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
    updateProgress(isBatchProcessing ? null : 50, "生成配置文件...");
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
    updateProgress(isBatchProcessing ? null : 70, "生成ARC项目文件...");
    addLog('info', '开始生成ARC项目文件...');
    
    const song = songlistJson.songs[0];
    const res = { charts: [] };
    let validCharts = 0;
    
    for (const chart of song.difficulties) {
        const diff = chart.ratingClass;
        const chartFile = `${diff}.aff`;
        const difficultyName = DIFF_MAPPING[diff] || `未知${diff}`;
        
        if (!files[chartFile]) {
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
    updateProgress(isBatchProcessing ? null : 90, "创建ARCpkg包...");
    addLog('info', '开始创建ARCpkg包...');
    
    const zip = new JSZip();
    const packId = songlistJson.songs[0]?.set || "pack001";
    const songId = songlistJson.songs[0]?.id || "root_song";
    
    addLog('info', `曲包ID: ${packId}, 歌曲ID: ${songId}`);
    
    // 创建曲包目录
    const packDir = zip.folder(packId);
    const packYml = {
        packName: `Pack ${packId}`,
        imagePath: `1080_select_${packId}.png`,
        levelIdentifiers: [`${userId}.${songId}`]
    };
    packDir.file(`${packId}.yml`, jsyaml.dump(packYml));
    addLog('info', `创建曲包配置: ${packId}.yml`);
    
    // 添加曲包封面
    if (files['base.jpg']) {
        packDir.file(`1080_select_${packId}.png`, files['base.jpg']);
        addLog('info', '添加曲包封面');
    } else {
        addLog('warning', '未找到base.jpg，曲包将使用默认封面');
    }
    
    // 创建歌曲目录
    const songDir = zip.folder(songId);
    const requiredFiles = [
        "base.jpg", "base.ogg", "slst.txt", "project.arcproj",
        ...songlistJson.songs[0].difficulties.map(d => `${d.ratingClass}.aff`)
    ];
    
    let copiedFiles = 0;
    for (const file of requiredFiles) {
        if (files[file]) {
            songDir.file(file, files[file]);
            copiedFiles++;
        } else {
            addLog('warning', `缺失文件: ${file}`);
        }
    }
    addLog('info', `复制了 ${copiedFiles} 个文件到歌曲目录`);
    
    // 创建索引文件
    const indexYml = [
        {
            directory: packId,
            identifier: `${userId}.${packId}`,
            settingsFile: `${packId}.yml`,
            version: 0,
            type: "pack"
        },
        {
            directory: songId,
            identifier: `${userId}.${songId}`,
            settingsFile: "project.arcproj",
            version: 0,
            type: "level"
        }
    ];
    zip.file("index.yml", jsyaml.dump(indexYml));
    addLog('info', '创建索引文件: index.yml');
    
    // 生成ARCpkg
    addLog('info', '正在压缩文件...');
    const arcpkgBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
    });
    arcpkgBlob.size = arcpkgBlob.size;
    
    addLog('success', `ARCpkg创建完成，大小: ${(arcpkgBlob.size / 1024 / 1024).toFixed(2)}MB`);
    return arcpkgBlob;
}

// 主处理函数（兼容批量/单文件）
async function processZipFile(file, userId) {
    try {
        // 单文件处理时重置界面，批量处理时保留历史结果
        if (!isBatchProcessing) {
            document.getElementById('progressSection').classList.remove('hidden');
            document.getElementById('errorSection').classList.add('hidden');
            document.getElementById('resultSection').classList.add('hidden');
        }

        addLog('info', `开始处理文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        addLog('info', `使用用户ID: ${userId}`);
        const arrayBuffer = await file.arrayBuffer();
        
        // 核心处理流程
        const files = await unzipSongPackage(arrayBuffer);
        const songInfo = await getSongInfoFromFiles(files);
        await createRootConfigFiles(files, songInfo, userId);
        await generateProjectFile(files, songInfo, userId);
        const arcpkgBlob = await createARCpkg(files, userId);
        
        // 生成下载链接
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `${currentSongTitle}_${timestamp}.arcpkg`;
        const downloadUrl = URL.createObjectURL(arcpkgBlob);
        
        // 单文件处理时更新进度为100%
        if (!isBatchProcessing) {
            updateProgress(100, "完成!");
        }
        
        // 显示结果
        const successMsg = isBatchProcessing 
            ? `🎉 第 ${completedBatchFiles + 1}/${totalBatchFiles} 个文件打包成功！`
            : "🎉 打包成功！";
        showSuccess(successMsg, downloadUrl, fileName);

    } catch (error) {
        if (!isBatchProcessing) {
            updateProgress(0, "处理失败");
        }
        showError(`打包失败：${error.message}`);
        throw error; // 批量处理时抛出错误，用于计数
    }
}
