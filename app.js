const HTTP = require("http");
const FS = require("fs");
const EJS = require("EJS");
const QS = require("querystring");

// 定数-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
/**
 * index.ejsのファイルオブジェクト。サーバ実行前に読み込まれる。
 */
const INDEX_PAGE = FS.readFileSync("./index.ejs", "utf8");
/**
 * login.ejsのファイルオブジェクト。サーバ実行前に読み込まれる。
 */
const LOGIN_PAGE = FS.readFileSync("./login.ejs", "utf8");
/**
 * メッセージの最大保管数
 */
const MAX_MSG = 10;
/**
 * メッセージを保管するファイル名
 */
const DATA_FILENAME = "mydata.txt";
/**
 * このアプリケーションのベースURL
 */
const BASE_URL = "http://localhost";
// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*

// グローバル変数-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
/**
 * メッセージの一時領域
 */
let message_data;
// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*

// メイン処理-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
// DATA_FILENAMEから保存メッセージを取得、保存
readMessageData(DATA_FILENAME);
// サーバを生成
const SERVER = HTTP.createServer(getFromClient);
SERVER.listen("3000");
console.log("Server start!");
// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*

// クライアントからサーバアクセス時のハンドラ-*-*-*-*-*-*-*-*-*-*-*-*-*
/**
 * createServerのコールバック関数
 * @param {HTTP.ClientRequest} request リクエスト
 * @param {HTTP.ServerResponse} response レスポンス
 */
function getFromClient(request, response) {
	// url.parseはfuture depricateなのでnew URLで代用
	// request.urlはベースURL以降の情報しか持たないので、
	// 第二引数にベースURLを渡すことで絶対パス情報としてrequest.urlを解析可能
	const url_parts = new URL(request.url, BASE_URL);

	// トップページに遷移
	if (url_parts.pathname === "/") {
		callIndexPage(request, response);
		return;
	}
	// ログインページに遷移
	if (url_parts.pathname === "/login") {
		callLoginPage(request, response);
		return;
	}
	// 存在しないURLの場合はエラーぺージを表示
	response.writeHead(200, { "Content-Type": "text/plain" });
	response.end("no page...");
	return;
}

/**
 * トップページへのアクセス処理。
 * @param {HTTP.ClientRequest} request リクエスト
 * @param {HTTP.ServerResponse} response レスポンス
 */
function callIndexPage(request, response) {
	// GET処理(トップページに遷移するだけ)
	if (request.method === "GET") {
		writeIndexPage(request, response);
		return;
	}
	// POST処理(送信データ(メッセージ)を保存してからトップページに遷移)
	if (request.method === "POST") {
		let body = "";
		request.on("data", (data) => {
			// {id: ユーザID, msg:メッセージ}のオブジェクトを受信
			body += data;
		});
		request.on("end", () => {
			const msgData = QS.parse(body);
			// 受信メッセージを保存
			addMessage(
				msgData.id,
				msgData.msg,
				msgData.datetime,
				DATA_FILENAME,
				request
			);
			writeIndexPage(request, response);
		});
	}
}

/**
 * ログインページへのアクセス処理。
 * @param {HTTP.ClientRequest} request リクエスト
 * @param {HTTP.ServerResponse} response レスポンス
 */
function callLoginPage(request, response) {
	const content = EJS.render(LOGIN_PAGE, {});
	response.writeHead(200, { "Content-Type": "text/html" });
	response.write(content);
	response.end();
}

/**
 * 保存データからメッセージを取得し、トップページを表示する。
 * @param {HTTP.ClientRequest} request リクエスト
 * @param {HTTP.ServerResponse} response レスポンス
 */
function writeIndexPage(request, response) {
	const msg = "Please write some message...";
	const content = EJS.render(INDEX_PAGE, {
		title: "Index",
		content: msg,
		data: message_data,
		filename: "data_item",
	});
	response.writeHead(200, { "Content-Type": "text/html" });
	response.write(content);
	response.end();
}
// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*

// ユーティリティ-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
/**
 * DATA_FILENAMEに保存されているメッセージを取得し、
 * message_dataに保存するメソッド。
 * @param {string} filename メッセージを保管するファイル名
 */
function readMessageData(filename) {
	FS.readFile(filename, "utf8", (err, data) => {
		message_data = data.split("\r\n");
	});
}

/**
 * ユーザIDとメッセージを一組message_dataに保存した後、
 * DATA_FILENAMEに保存するメソッド。<br>
 * メッセージ数がMAX_MSGを超える場合、古いメッセージを削除する。
 * @param {string} id ユーザID
 * @param {string} msg メッセージ
 * @param {string} datetime メッセージ送信日時
 * @param {string} filename メッセージを保管するファイル名
 */
function addMessage(id, msg, datetime, filename) {
	const msgObj = {
		id: id,
		msg: msg,
		datetime: datetime,
	};
	const msgOjb_str = JSON.stringify(msgObj);
	console.log("add Message:" + msgOjb_str);
	message_data.unshift(msgOjb_str);
	if (message_data.length > MAX_MSG) {
		message_data.pop();
	}
	// DATA_FILENAMEへの保存を実行
	saveFile(filename);
}

/**
 * DATA_FILENAMEへメッセージを保存するメソッド。<br>
 * 保存時に各メッセージを改行で区切る。
 * @param {string} filename メッセージを保管するファイル名
 */
function saveFile(filename) {
	const writeData = message_data.join("\r\n");
	FS.writeFile(filename, writeData, (err) => {
		if (err) {
			throw err;
		}
	});
}
// -*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*
