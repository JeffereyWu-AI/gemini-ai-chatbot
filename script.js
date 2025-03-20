const container = document.querySelector('.container'); // 聊天容器
const chatsContainer = document.querySelector('.chats-container'); // 存储所有聊天消息的容器
const promptForm = document.querySelector('.prompt-form'); // 用户输入表单
const promptInput = promptForm.querySelector('.prompt-input'); // 输入框
const fileInput = promptForm.querySelector('#file-input'); // 文件上传输入框
const fileUploadWrapper = promptForm.querySelector('.file-upload-wrapper'); // 文件上传的 UI 包装容器
const themeToggle = document.querySelector('#theme-toggle-btn');

// API Setup
const API_KEY = "";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller; // 全局变量，作用域覆盖整个脚本
const chatHistory = [];
const userData = { message: "", file: {} }; // 存储当前用户消息和上传的文件

// Function to create message elements
// 接收内容和多个类名作为参数，创建div元素后，为其添加类名并设置内容
const createMsgElement = (content, ...classes) => {
    const div = document.createElement('div');
    div.classList.add("message", ...classes)
    div.innerHTML = content;
    return div;
}

// Scroll to the bottom of the container
// 让聊天窗口自动滚动到底部，以保持最新消息可见
// 将容器的滚动条位置设置为容器的最大滚动高度，即滚动到容器的最底部
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth"});

// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;

    // Set an interval to type each word
    // 每隔 40 毫秒执行一次
    typingInterval = setInterval(() => {
        if(wordIndex < words.length){
            textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
            document.body.classList.add("bot-responding");
            scrollToBottom();
            // 为 body 添加 bot-responding 类，表示机器人正在响应，并调用 scrollToBottom 滚动到容器底部
        } else {
            // 如果所有单词都显示完毕，清除定时器
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading"); // remove the loading animation only after all the words are typed
            document.body.classList.remove("bot-responding");
        }
    }, 40);
}

// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
    const textElement = botMsgDiv.querySelector(".message-text");
    controller = new AbortController();  // 用于控制请求的中断

    // Add user message and file data to the chat history
    chatHistory.push({
        role: "user",
        parts: [{ text: userData.message }, 
            ...(userData.file.data ? 
                [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])]
    });
    // 从 userData.file 对象中提取除 fileName 和 isImage 之外的其他属性，并将其赋值给 inline_data

    try {
        // Send the chat history to the API to get a response
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chatHistory }),
            signal: controller.signal // attach the controller to terminate the fetch request
        });

        const data = await response.json();
        if(!response.ok) throw new Error(data.error.message);

        // Process the response text and display with typing effect
        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
        // 匹配以 ** 开头和结尾的内容，([^*]+) 捕获 ** 之间的内容。
        typingEffect(responseText, textElement, botMsgDiv);
        
        chatHistory.push({
            role: "model",
            parts: [{ text: responseText }]
        });
    } catch (error) {
        textElement.style.color = "#d62939";
        textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
        botMsgDiv.classList.remove("loading"); // remove the loading animation only after all the words are typed
        document.body.classList.remove("bot-responding");
        scrollToBottom();
    } finally {
        userData.file = {};
    }
}
// Handle the form submission
const handleFormSubmit = (e) => {
    // 阻止表单的默认提交行为
    e.preventDefault();
    // 从输入框中获取用户输入并去除首尾空格
    const userMessage = promptInput.value.trim();
    // 如果用户输入为空或机器人正在响应，则直接返回
    if(!userMessage || document.body.classList.contains("bot-responding")) return;

    // 将输入框的值清空
    promptInput.value = "";
    // 将用户输入的消息存储到 userData 对象中
    userData.message = userMessage;
    // 机器人正在响应且聊天处于活跃状态
    document.body.classList.add("bot-responding", "chats-active");
    // 移除文件上传相关的 UI 状态类
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    // Generate user message HTML with optional file attachment
    // 根据用户输入和文件附件生成用户消息的 HTML 内容
    const userMsgHTML = `
        <p class="message-text"></p>
        ${userData.file.data ? (userData.file.isImage ? 
            `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : 
            `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
        ) : ""}
    `;

    // 创建用户消息的 DOM 元素，并将其添加到聊天容器中。
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();  // 使聊天窗口自动滚动到底部，确保最新消息可见。

    // 在 600 毫秒后生成机器人消息的 HTML 内容，并将其添加到聊天容器中
    setTimeout(() => {
        // Generate bot message HTML and add in the chats container after 600ms
        const botMsgHTML = `<img src="gemini-chatbot-logo.svg" class="avatar"><p class="message-text">Just a sec..</p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom();
        generateResponse(botMsgDiv);
}, 600);
}

// Handle file input change (file upload)
fileInput.addEventListener("change", () => {
    // 从文件输入框中获取用户选择的第一个文件
    const file = fileInput.files[0];
    if(!file) return;

    // 检查文件是否为图片类型
    const isImage = file.type.startsWith("image/");
    // 使用 FileReader 对象读取文件内容，并将其转换为 Data URL 格式
    const reader = new FileReader();
    reader.readAsDataURL(file);

    // 处理读取完成事件
    reader.onload = (e) => {
        // 清空文件输入框的值
        fileInput.value = "";
        // 将 Data URL 转换为 Base64 字符串
        const base64String = e.target.result.split(",")[1]
        // 更新文件预览的 src 属性，显示文件内容
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        // 根据文件类型（图片或非图片）为文件上传包装容器添加相应的类名
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

        // Store file data in userData obj
        userData.file = {fileName: file.name, data: base64String, mime_type: file.type, isImage }
    }
});

// Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    // 清空文件数据
    userData.file = {};
    // 移除文件上传 UI 状态
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
})

// Stop ongoing bot response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
    // 清空文件数据
    userData.file = {};
    // 中止 API 请求
    controller?.abort();
    // 清除机器人打字效果的定时器，停止打字动画
    clearInterval(typingInterval)
    // 移除加载状态
    chatsContainer.querySelector(".bot-message.loading").classList.remove("loading");
    // 移除机器人响应状态 
    document.body.classList.remove("bot-responding");
})

// Delete all chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
})

// Handle suggestions click
document.querySelectorAll(".suggestions-item").forEach(item => {
    item.addEventListener("click", () => {
        // 当用户点击某个建议项时，将该建议项的内容填充到输入框中
        promptInput.value = item.querySelector(".text").textContent;
        // 触发表单的 submit 事件，从而模拟用户提交表单的行为，启动聊天流程
        promptForm.dispatchEvent(new Event("submit"));
    })
})

// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target}) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    // 如果点击的目标是输入框，则需要隐藏控制按钮。
    const shouldHide = target.classList.contains("prompt-input") || 
    (wrapper.classList.contains("hide-controls") && 
        (target.id === "add-file-btn" || target.id === "stop-response-btn"));
    // 如果控制按钮已经隐藏 (wrapper.classList.contains("hide-controls"))，
    // 并且点击的目标是“添加文件”按钮 (target.id === "add-file-btn") 
    // 或“停止响应”按钮 (target.id === "stop-response-btn")，也需要隐藏控制按钮。
    wrapper.classList.toggle("hide-controls", shouldHide);
    // 切换控制按钮的显示状态
});

// Toggle dark/light theme
themeToggle.addEventListener("click", () => {
    // 如果 light-theme 类被添加到 body 元素中，则 isLightTheme 的值为 true，表示当前是浅色主题。
    const isLightTheme = document.body.classList.toggle("light-theme");
    // 将当前主题状态（isLightTheme）存储到 localStorage
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode")
    // 更新按钮文本
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// Set initial theme from local storage
// 从本地存储中获取主题状态
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

// 当用户提交表单时，调用 handleFormSubmit 函数。
promptForm.addEventListener("submit", handleFormSubmit);
// 模拟用户点击文件输入框，打开文件选择对话框
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
// 用户选择文件后，触发 fileInput 的 change 事件，执行文件上传的相关逻辑。