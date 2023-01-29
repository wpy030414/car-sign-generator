function isChar(bit) {
    if (/[a-z]/.test(bit) || /[A-Z]/.test(bit))
        return true;
    return false;
}

function isNum(bit) {
    if (/\d/.test(bit))
        return true;
    return false;
}

function setSign(code) {
    if (!(/^[A-Z0-9]{3}·[A-Z0-9]{3}使$/.test(code))
        && !(/^\W[A-Z0-9]{3}·[A-Z0-9]{2}领$/.test(code))
        && !(/^\W[A-Z]·[A-Z0-9]{4}[港澳学]$/.test(code))
        && !(/^\W·[A-Z][A-Z0-9]{4}警$/.test(code))
        && !(/^\W[A-Z]·[A-Z0-9]{5}$/.test(code))
        && !(/^\W[A-Z]·[ABCDEFGHJK][A-Z0-9]{5}$/.test(code))
        && !(/^\W[A-Z]·[A-Z0-9]{5}[ABCDEFGHJK]$/.test(code))
        && !(/^\W·[A-Z0-9]{5}应急$/.test(code)))
        return false;

    var plate = document.getElementById("iron-plate"),
        theme = "theme-";
    if (code.length == 8) {
        if (code.includes("使") || code.includes("领")
            || code.includes("港") || code.includes("澳"))
            theme += "special";
        else if (code.includes("学"))
            theme += "big";
        else if (code.includes("警"))
            theme += "police";
        else
            theme += "small";
        plate.setAttribute("class", "");
    }
    else {
        if (code.includes("应急")) {
            theme += "police";
            plate.setAttribute("class", "new-energy emergency");
        } else if (/[ABCDEFGHJK]$/.test(code[8])) {
            theme += "big";
            plate.setAttribute("class", "new-energy big");
        } else {
            theme += "new-energy";
            plate.setAttribute("class", "new-energy");
        }
    }
    theme += "-cars.css";
    document.getElementById("theme").setAttribute("href", theme);

    var info = document.getElementById("info");
    info.innerHTML = "";
    for (let i = 0; i < code.length; i++) {
        let bit = document.createElement("div");
        if (isChar(code[i]))
            if (i == 2 && code.includes("应急"))
                bit.setAttribute("class", "bit char red");
            else
                bit.setAttribute("class", "bit char");
        else if (isNum(code[i]))
            bit.setAttribute("class", "bit num");
        else if (code[i] == "·")
            bit.setAttribute("class", "bit dot");
        else if (code[i] == "警" || code[i] == "应" || code[i] == "急")
            bit.setAttribute("class", "bit char-cn red");
        else
            bit.setAttribute("class", "bit char-cn");
        bit.innerText = code[i];
        info.appendChild(bit);
    }
    return true;
}

function setPresets() {
    switch (document.getElementById("presets").value) {
        case "new-energy":
            setSign("京A·D00001");
            break;
        case "big":
            setSign("京A·0001学");
            break;
        case "big-new-energy":
            setSign("京A·00001D");
            break;
        case "police":
            setSign("京·A0001警");
            break;
        case "emergency":
            setSign("京·X0001应急")
            break;
        case "special-1":
            setSign("001·001使");
            break;
        case "special-2":
            setSign("京001·01领");
            break;
        case "special-3":
            setSign("粤Z·0001港");
            break;
        case "special-4":
            setSign("粤Z·0001澳");
            break;
        default:
            setSign("京A·00001");
    }
}

function setUsersets() {
    var code = document.getElementById("code");
    if (code.value != "")
        if (setSign(code.value)) {
            code.value = "已设置。";
            document.getElementById("presets").value = "";
        } else
            code.value = "非法的牌号！";
}