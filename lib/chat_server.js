var socketio = require('socket.io');
var mysql = require('mysql'); //MySQL API 불러오기
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var CURRENT_ROOM = {};
var CHAT_LIST = new Array(); //송신 되는 메세지들을 저장하기 위한 변수
var tmp = new Array();  //DB에 저장하기 위해 메세지들을 저장하는 변수
var str = '';   //메세지들을 하나의 문자열 형태로 결합하여 저장하는 변수
var encryption = require('./encode_msg.js');
var crypto = require('crypto');
const socketAsync = require('./dbModule');

const pg = require('pg');
const dbConfig = require('../Database/dbConfig.json');


// 동기 처리를 위한 Step 라이브러리 사용
var Step = require('step');
var Async = require('async');
const { exception } = require('console');

//MySQL 접속
// var db = mysql.createConnection({
//     host: "huimysql.mysql.database.azure.com",
//     user: "huiadmin@huimysql",
//     password: "Emrjdnsrkawk2ro",
//     database: "hui",
//     port: 3306
// });

var db = '';

const client = new pg.Client(dbConfig.Dev);
client.connect(err => {
    if (err)
        console.log(err);
    else
        console.log("SUCCESS!!!!!!!!!!!");
});

// var db = mysql.createConnection({
//     host     : 'localhost',
//     user     : 'root',
//     password : 'adjnj',
// });

// db.query('USE HUI');


//Socket.IO 서버를 시작하고  Socket.IO가 콘솔에 출력하는 로깅을 제한하며 유입되는 연결을 처리 -->

exports.listen = function (server) {
    io = socketio.listen(server);
    // io.set('log level', 1);

    // let testSocket = await socketAsync.SocketsOnAsync(io, 'connection');

    io.sockets.on('connection', function (socket) {
        console.log("socket connect success");

        CreateMember(socket);
        VerifyMember(socket);
        GetUserInfo(socket);
        CreateNewChatroom(socket);
        GetFriends(socket);
        AddNewFriend(socket);
        GetChatRoom(socket);
        UpdateSettings(socket);

        ChangeNickname(socket);
        ChangePassword(socket);

        UpdateChatroomName(socket);

        return;

        // 채팅방 버튼 클릭 이벤트가 발생 하였을 때
        //handleRoomJoining(socket);


        //프로필 사진 변경
        updatePhoto(socket);



        //방 입장
        JoinRoom(socket);

        // 친구 초대
        InviteNewFriend(socket);

        //메세지 전송
        handleMessageProcess(socket);

        //접속해제시 실행
        handleClientDisconnectionProcess(socket);

        // guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed); //사용자 접속시 손님 닉네임 부여
        // joinRoom(socket, 'Lobby'); //사용자가 접속하면 대기실로 이동
        // handleMessageBroadcasting(socket, nickNames); //메세지 처리
        // handleNameChangeAttempts(socket, nickNames, namesUsed); //닉네임 변경 처리
        // handleRoomJoining(socket); //채팅방 생성이나 변경 처리

        // //이미 생성된 채팅방 목록을 사용자에게 제공
        // socket.on('rooms', function() {
        //  socket.emit('rooms', io.sockets.manager.rooms);
        // });

        // //접속 끊었을 때의 처리
        // handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

//사용자 닉네임 처리
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name; //닉네임을 클라이언트 연결 아이디와 연동
    socket.emit('nameResult', { //사용자에게 닉네임을 알려줌
        success: true,
        name: name
    });
    namesUsed.push(name); //생성된 닉네임을 사용 중 닉네임에 추가
    return guestNumber + 1;
}


////채팅방 입장 처리
//function joinRoom(socket, room) {
//    socket.join(room);
//    // 방의 아이디 생성
//    currentRoom[socket.id] = room; //사용자가 입장한 방의 정보를 저장
//
//    //이전에 주고받은 메세지 목록을 불러옴
//    var query = "SELECT chatList FROM `ChatList` where m_index = ? order by `test`.`chatTime` ASC";
//    db.query(
//            query,[100],
//            function(err,rows){
//                if(err) throw err;
//                else{
//                    var decodeRows = decodeMessage(rows);
//                    socket.emit('prevMessage',{rows : decodeRows});
//                }
//            }
//    );//db query end
//
//    db.query(query,function(err,results){
//        if(err)
//        {
//            throw err;
//        }
//        else
//        {
//            /* DB에서 불러온 채팅 목록을 화면에 뿌려주도록 한다. --> 서버에서 스크립트를 보내서 뿌려줄것인지
//                아니면 데이터만 보내준 뒤에 클라이언트에서 처리할 것인지?
//            */
//
//        }
//    });
//
//    socket.emit('joinResult', {room: room}); //사용자에게 채팅방에 입장한 사실을 알림
//    socket.broadcast.to(room).emit('message', { //채팅방의 다른 사용자에게 새로운 사용자가 입장했음을 알림
//        text: nickNames[socket.id] + ' has joined ' + room + '.'
//    });
//
//    var usersInRoom = io.sockets.clients(room); //사용자가 참여한 방에 다른 사용자가 있는지 판단
//    if (usersInRoom.length > 1) { //다른 사용자가 있는 경우
//        var usersInRoomSummary = 'Users currently in ' + room + ': ';
//        for (var index in usersInRoom) {
//            var userSocketId = usersInRoom[index].id;
//            if (userSocketId != socket.id) {
//                if (index > 0) {
//                    usersInRoomSummary += ', ';
//                }
//                usersInRoomSummary += nickNames[userSocketId];
//            }
//        }
//        usersInRoomSummary += '.';
//        socket.emit('message', {text: usersInRoomSummary});
//    }
//}

//닉네임 변경 처리
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) { //등록되지 않은 닉네임이라면 등록
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex]; //변경 전 닉네임은 삭제
                socket.emit('nameResult', {
                    success: true,
                    name: name
                });
                socket.broadcast.to(CURRENT_ROOM[socket.id]).emit('message', {
                    text: previousName + ' is now known as ' + name + '.'
                });
            } else {
                socket.emit('nameResult', { //이미 등록된 닉네임인 경우 클라이언트에 오류 전송
                    success: false,
                    message: 'That name is already in use.'
                });
            }
        }
    });
}

//메세지가 송신된 시각을 반환하는 함수
function sendedTime() {
    var now = new Date();
    return (now.toDateString() + " " + now.getHours() + ':'
        + ((now.getMinutes() < 10) ? ("0" + now.getMinutes()) : (now.getMinutes())));
}

//'시:분:초'형태로 반환
Date.prototype.getTime = function () {
    return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":"
        + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
}

// //메세지와 보낸 사람을 정해진 형태의 문자열로 만들어 배열(chatList)에 저장
// function messageFormat (msg, sender){
//     chatList.push('{"time":"'+sendedTime()+'","msg":'+encryption.encodeMessage(msg)+',"sender":"'+sender+'"}');
// }

//XSS공격 방지(ASCII문자를 동일한 의미의 HTML문자로 변경)
function escape(message) {
    message = message.toString();
    var escaped = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped;
}
// //메세지 처리
// function handleMessageBroadcasting(socket) {
//     socket.on('message', function (message) {
//         var escaped = escape(message.text);
//         //메세지(msg)를 {"time":"메세지 송신 시간","msg":"메세지 내용","sender":"보낸 사람"} 형태로 배열에 저장
//         messageFormat(escaped,nickNames[socket.id]);
//         //{"number":메세지 갯수,"message":[{msg},{msg},{msg},{msg},.....,{msg}]}형태의 문자열을 DB에 저장
//         if(chatList.length == 20){
//             tmp = chatList;
//             //배열의 원소들을 하나의 문자열로 결합
//             for (var i in tmp)
//                 str += tmp[i]+',';
//             str = str.substring(0,str.lastIndexOf(","));
//             //DB에 저장할 형태로 변경
//             var sentence = '{"number":'+tmp.length+',"message":'+'[' +str+']}';
//             //data1 : 가장 오래된 메세지의 송신 시각 , data2 : 문자열(메세지들)
//             db.query('INSERT INTO test ' +  'SET data1 = ?, data2 = ?',
//                     [new Date(JSON.parse(sentence).message[0].time).getTime(),sentence], function(err, result) {
//                 if (err) {
//                     console.log(err);
//                 } else {
//                     console.log('success > the number of data is 20');
//                     //변수 초기화
//                     tmp = new Array();
//                     chatList = new Array();
//                     str='';
//                 }
//             });
//         }

//         socket.broadcast.to(message.room).emit('message', {
//             text: nickNames[socket.id] + ': ' + message.text
//         });
//     });
// }

//채팅방 만들기 처리
function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(CURRENT_ROOM[socket.id]); //현재 있던 방에서 나옴
        JoinRoom(socket, room.newRoom); //이미 만들어진 채팅방이나 새로운 채팅방을 만듦
    });
}

// //사용자의 접속 해제 처리
// function handleClientDisconnection(socket) {
//     socket.on('disconnect', function() {
//         //메세지 20개가 쌓이기 전-채팅방에 접속해 있던 사람이 접속해제를 할때, chatList에 저장되어 있는 메세지를 DB에 저장
//         if(chatList.length>0){
//             tmp = chatList;
//             for(var i in tmp)
//                 str += tmp[i]+',';
//             str = str.substring(0,str.lastIndexOf(","));
//             var sentence ='{"number":'+tmp.length+',"message":'+'[' +str+']}';
//             db.query('INSERT INTO test ' + 'SET data1 = ?, data2 = ?',
//                     [new Date(JSON.parse(sentence).message[0].time).getTime(),sentence], function(err, result) {
//                 if (err) {
//                     console.log(err);
//                 } else {
//                     console.log('success > the number of data is '+tmp.length);
//                     tmp = new Array();
//                     chatList=new Array();
//                     str='';

//                 }
//             });

//         }
//         var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
//         //사용자의 닉네임 삭제
//         delete namesUsed[nameIndex];
//         delete nickNames[socket.id];
//     });
// }

//File_Name : chat_server.js
//Function_Name : verifyMember
//Input_Data : socket
//Output_Data : {verify : true} or {verify : false}
//Description : 사용자가 로그인 폼에 입력한 정보가 올바른지 판단
function VerifyMember(socket) {
    socket.on('verifyMember', async function (data, callback) {
        var identification = JSON.parse(data);
        var encryptedPw = encryptPw(identification.memPW);

        var selectQuery = 'SELECT COUNT(*) AS exist FROM MemberInfo WHERE memID = $1 and memPW = $2';
        var selectParams = [identification.memID, encryptedPw];

        try {
            const result = await client.query(selectQuery, selectParams);
            const resultRows = result.rows;
            const isExist = resultRows && resultRows[0] ? Number(resultRows[0].exist) : 0;
            if (isExist == 1)
                socket.emit('verifyMemberResult', { verify: true });
            else
                socket.emit('verifyMemberResult', { verify: false });
        } catch (error) {
            console.log(error);
        }
    });
}

function encryptPw(passwd) {
    var md5hash;
    var sha512hash;
    var combine;
    var encrypted;
    md5hash = crypto.createHash('md5').update(passwd).digest('hex');
    sha512hash = crypto.createHash('sha512').update(passwd).digest('hex');
    combine = md5hash + 'cherryBlossomWind' + sha512hash;
    encrypted = crypto.createHash('sha256').update(combine).digest('hex');
    return encrypted
}

/*
 * 2015. 04. 03. 11:20
 * creator : Hanbyul Kang
 * Description : Create member information function
 * input : socket, member nickname, id, PW
 * output : success message
 */
async function CreateMember(socket) {
    socket.on('createMember', async function (data) {
        try {
            var queryValue = JSON.parse(data);
            var selectQuery = 'SELECT memID FROM MemberInfo WHERE memID = $1';
            var selectParams = [queryValue.memID];

            const result = await client.query(selectQuery, selectParams);
            const resultRows = result.rows;
            if (Array.isArray(resultRows) && resultRows.length > 0) {
                socket.emit('createMemberResult', "exist");
                return;
            }

            var encryptedPw = encryptPw(queryValue.memPW);
            var insertQuery = 'INSERT INTO MemberInfo(memID, memPW, nickname, photo, personalSetting) VALUES ($1, $2, $3, $4, $5);';
            var insertParam = [queryValue.memID, encryptedPw, queryValue.nickName, queryValue.photoURL, JSON.stringify(queryValue.personalSetting.toString())];
            const insertResult = await client.query(insertQuery, insertParam);
            const insertResultRow = insertResult.rows;
            let friendResult = await CreateNewFriendList(queryValue.memID);
            if (friendResult)
                socket.emit('createMemberResult', "success");

        } catch (error) {
            console.log(error);
            socket.emit('createMemberResult', "error");
        }
    });
}// create member end

/*
 * creator : Hanbyul Kang
 * Description : add friend list default value
 * input : memberID
 * output : success message
 */
async function CreateNewFriendList(memID) {
    try {
        const selectMindexFriendList = "SELECT m_index FROM MemberInfo WHERE memID = $1";
        const selectResult = await client.query(selectMindexFriendList, [memID]);
        const memeberIndex = selectResult.rows[0].m_index;

        const insertNewFriendList = "INSERT INTO FriendList (m_index, memID) VALUES ($1, $2);";
        const insertResult = await client.query(insertNewFriendList, [memeberIndex, memID]);
        return true;
    } catch (error) {
        console.error(error);
    }
    return false;
}

/*
 * 2015. 04. 17. 10:11
 * creator : Hanbyul Kang
 * Description : Read Room List from Database
 * input : memID, r_index
 * output : chatMsgList
 */
function readChatContentList(socket) {
    console.log("IN read chat List");
    socket.on('readChatList', function (inputData) {
        // raw data
        var parsedData = JSON.parse(inputData);
        // parse memeber id to raw data
        var memID = parsedData.memID;
        var r_index = parsedData.r_index;
        // Exist ID check
        var checkQuery = "SELECT m_index FROM MemberInfo WHERE memID = ?;";
        db.query(checkQuery, [memID], function (err, checkResult) {
            // 아이디가 없을 경우에 에러 처리
            if (err) {
                // 에러처리 후 false 전송
                console.log(err);
                socket.emit('readChatList', JSON.stringify({ num: 0, memList: false }));
            } else {
                if (JSON.stringify(checkResult) == '[]') {
                    //아이디가 없으면 비정상적으로 들어온 경로 이므로 에러 호출.
                    console.log(checkResult);
                    socket.emit('readChatList', JSON.stringify({ num: 0, memList: false }));
                } else {
                    console.log("read chat content List check id result : " + checkResult);
                    var m_index = checkResult;
                    // 채팅 목록 불러오기
                    var readQuery = "SELECT chatMsgList FROM ChatContentList WHERE r_index = ?;";
                    db.query(readQuery, [r_index], function (err, readResult) {
                        if (err) {
                            //에러처리
                            console.log(err);
                            socket.emit('readChatList', JSON.stringify({ num: 0, memList: false }));
                        } else {
                            console.log("readResult " + readResult);
                            //불러온 결과를 JSON 형태의 문자열로 해서 클라이언트에 전송
                            socket.emit('readChatList', JSON.parse(readResult[0].chatMsgList));
                        }
                    }); //db query end
                } //  read chat list else end
            }// id check else end
        }); //check id query end
    });
}//read Room List function end

// Function name : createNewChatrooom
// Descritpion : send result that success or fail message.
// Input : JSON data (userID, roomName, createdTime)
// Output : result message ( true or false )
// Author : Hanbyul Kang
function CreateNewChatroom(socket) {
    socket.on('sendForCreateRoom', async function (inputData) {
        var parsedData = JSON.parse(inputData);
        var inUserUID = parsedData.userUID;

        let roomName = encodeURI(parsedData.roomName);
        let memberIndex = 0;
        var createdTime = parsedData.createdTime;

        try {
            var findIndexQuery = "SELECT m_index FROM MemberInfo WHERE memID = $1;";
            var findParam = [inUserUID];
            const findResult = await client.query(findIndexQuery, findParam);
            memberIndex = findResult.rows[0].m_index;
        } catch (error) {
            console.log("select member index error : " + error);
            var falseJsonResult = JSON.stringify({ resultRoomName: roomName, boolResult: 'false', r_index: 'error' });
            socket.emit('sendForCreateRoomResult', falseJsonResult);
            return;
        }

        try {
            // 방목록 및 joinedMember에 자기 자신을 집어넣기
            var insertJoinMem = JSON.stringify({ memNum: 1, memList: [memberIndex] });
            var inserChatlistQuery = "INSERT INTO RoomList(roomName, joinedMem) VALUES ($1, $2)";
            var chatlistParam = [roomName, insertJoinMem];
            const rsss = await client.query(inserChatlistQuery, chatlistParam);

            // 방 인덱스 선택
            var selectRindexQuery = "SELECT r_index FROM RoomList WHERE roomName = $1;";
            const selectRIndexResult = await client.query(selectRindexQuery, [roomName]);
            let roomIndex = Number(selectRIndexResult.rows[0].r_index);

            // MemberInfo테이블에 있는 rIndexList를 불러온다.
            var selectListQuery = "SELECT r_IndexList FROM MemberInfo WHERE m_index = $1";
            const selectQueryResult = await client.query(selectListQuery, [memberIndex]);
            const roomIndexListRaw = selectQueryResult.rows[0].r_indexlist;
            let roomIndexList = JSON.parse(roomIndexListRaw);

            // num값 업데이트 및 r_index를 rIndexList에 push
            var num = roomIndexList.num;
            var rIndexList = roomIndexList.rIndexList;
            num += 1;
            rIndexList.push(roomIndex);
            var updatedList = JSON.stringify({ num: num, rIndexList: rIndexList });
            var updateQuery = "UPDATE MemberInfo SET r_IndexList = $1 WHERE m_index = $2;";
            const updateResult = await client.query(updateQuery, [updatedList, memberIndex]);

            var trueJsonResult = JSON.stringify({ resultRoomName: roomName, boolResult: 'true', r_index: roomIndex });
            socket.emit('sendForCreateRoomResult', trueJsonResult);
        } catch (error) {
            console.log("insert into chat list error : " + error);
            var falseJsonResult = JSON.stringify({ resultRoomName: roomName, boolResult: 'false', r_index: 'error' });
            socket.emit('sendForCreateRoomResult', falseJsonResult);
            return;
        }
    }); // socket on sendforcrateroom end
}
// Function name : updateChatroomName
// Descritpion : 대화방 이름 변경
// Input : r_index / new Room Name
// Output :
// Author : Hanbyul Kang
function UpdateChatroomName(socket) {
    socket.on('updateChatroomName', async function (inputData) {
        try {
            var parsedData = JSON.parse(inputData);
            var r_index = parsedData.r_index;       //기존의 r_index
            var newName = parsedData.newName;       //새로 바꿀 room Name

            // 기존의 roomName에서 업데이트
            var updateNameQuery = "UPDATE ChatList SET roomName = $1 WHERE r_index = $2;";
            const updateNameResult = await client.query(updateNameQuery, [newName, r_index]);

            socket.emit('updateChatroomNameFront', JSON.stringify({ roomName: newName, result: true }));
            return;
        } catch (error) {
            console.error(error);
        }
        socket.emit('updateChatroomNameFront', JSON.stringify({ roomName: "error", result: false }));

    });
}
// Function name : inviteNewFriend
// Descritpion : We invite new friends to chat rooms.
// Input : JSON data (friend List / memID / r_index)
// Output : result message ( true or false )
// Author : Hanbyul Kang
function InviteNewFriend(socket) {
    socket.on('inviteNewFriend', async function (newFriendData) {
        var parsedRawData = JSON.parse(newFriendData);

        var inMemID = parsedRawData.memID;
        var friendMemId = parsedRawData.friendName;
        var r_index = parsedRawData.r_index;
        var m_index;

        try {
            // 친구의 m_index를 불러온다.
            var friendIndexQuery = "SELECT m_index FROM MemberInfo WHERE memID = ?;";
            const friendIndexResult = await client.query(friendIndexQuery, [friendMemId]);
            const friendMIndex = friendIndexResult.rows[0].m_index;

            // r_index로 방의 joinedMember를 불러온다.
            var CheckQuery = "SELECT joinedMember FROM ChatList WHERE r_index = ?;";
            const joinedMemberResult = await client.query(CheckQuery, [r_index]);
            const joinedMember = joinedMemberResult.rows[0].joinedMember;

            // var joinedMember = JSON.parse(queryResult[0].joinedMember);
            var existMemNum = joinedMember.memNum;     // 현재 joinedMember의 친구 수
            var existMemList = joinedMember.memList;    // 현재 memList

            existMemNum += 1;
            joinedMember.memList.push(friendMIndex);

            // 데이터를 다시 직렬화 한다.
            joinedMember = JSON.stringify({ memNum: existMemNum, memList: existMemList });
            callback(null, joinedMember);

            //실제 업데이트
            var updateJoinedMemberQuery = "UPDATE ChatList SET joinedMember = ? WHERE r_index = ?;";
            await client.query(updateJoinedMemberQuery, [joinedMember, r_index]);

            // MemberInfo테이블에 있는 rIndexList를 불러온다.
            var selectList = "SELECT r_indexList FROM MemberInfo WHERE m_index =?;";
            const rIndexListResult = await client.query(selectList, [m_index]);

            // queryResult 안에 있는 r_indexList를 꺼냄
            var r_indexList = JSON.parse(rIndexListResult.rows[0].r_indexList);

            // pop을 하기 전의 r_indexList
            // m_index로 r_indexList에서 r_index를 삭제한다.
            r_indexList.rIndexList.push(r_index);
            // push을 하고 난 후의 r_indexList

            r_indexList.num += 1;

            // MemberInfo 테이블의 r_indexList 업데이트
            var tempString = JSON.stringify(r_indexList);
            // 업데이트 쿼리
            var updateIndexQuery = "UPDATE MemberInfo SET r_indexList = ? WHERE m_index = ?;";
            await client.query(updateIndexQuery, [tempString, m_index]);

            socket.emit('inviteNewFriend', true);
            return;
        } catch (error) {
            console.log(error);
        }
        socket.emit('inviteNewFriend', false);
    });
}


// Function name : getOutRoom
// Description : 채팅방에서 나갈 때 쓰는 함수
// Input : JSON 형태의 memID / room index
// Output : 결과 메시지 ( true / false )
function getOutRoom(socket) {
    socket.on('getOutRoom', function (data, callback) {
        // memID 와 Room Name을 받아온다.
        var userData = JSON.parse(data);
        var memID = userData.memID;     // 멤버 아이디
        var rindex = userData.r_index;  // room 인덱스

        // 동기 처리 시작
        Async.waterfall([
            // memID로 m_index를 가져온다.
            function (callback) {
                // select 쿼리문
                var selectInfoquery = "SELECT m_index, joinedMember FROM MemberInfo WHERE memID = ?";
                db.query(selectInfoquery, [memID], function (err, selectInforesult) {
                    if (err) {
                        // 에러 처리 후 false 전달
                        console.log("select info query error : " + err);
                        socket.emit('getOutRoomFront', false);
                    } else {
                        // 결과값 handling
                        console.log("select info query : " + selectInforesult);
                        // 다음 함수로 r_indexList 및 m_index 전달
                        callback(null, selectInforesult[0].r_indexList, selectInforesult[0].m_index);
                    }
                });
            },
            // MemberInfo 테이블 안의 r_indexList를 업데이트 한다. => 삭제
            function (r_indexList, m_index, callback) {
                // pop을 하기 전의 r_indexList
                console.log("Before pop r_indexList : " + rIndexList.rIndexList);
                // m_index로 r_indexList에서 r_index를 삭제한다.
                r_indexList.rIndexList.pop(rindex);
                // pop을 하고 난 후의 r_indexList
                console.log("After pop r_indexList : " + rIndexList.rIndexList);
                // MemberInfo 테이블의 r_indexList 업데이트
                // 업데이트 쿼리
                var updateIndexQuery = "UPDATE MemberInfo SET r_indexList =? WHERE m_index = ?;";
                db.query(updateIndexQuery, [r_indexList, m_index], function (err, updateIndexResult) {
                    if (err) {
                        // 에러 처리 후 false 전달
                        console.log("update r_indexList query error : " + err);
                        socket.emit('getOutRoomFront', false);
                    } else {
                        // 업데이트 결과 출력
                        console.log("update r_indexList query result : " + updateIndexResult);
                        // 다음 함수로 m_index 전달
                        callback(null, m_index);
                    }
                });
            },
            // r_index로 알아온 joinedMember에 m_index가 있는지 확인한다.
            function (m_index, callback) {
                // select 쿼리문
                var selectMemQuery = "SELECT joinedMember FROM ChatList WHERE r_index = ?";
                db.query(selectMemQuery, [rindex], function (err, selectMemResult) {
                    if (err) {
                        // 에러 처리 후 false 전달
                        console.log("select joinedmember query error : " + err);
                        socket.emit('getOutRoomFront', false);
                    } else {
                        var inResult = false;
                        // 결과 안에 해당하는 m_index 값이 있는지 확인
                        console.log("select joinedmember query result : " + selectMemResult);
                        for (var i = 0; i < selectMemResult[0].memList.length; i++) {
                            // m_index값이 있으면
                            if (selectMemResult[0].memList[i] == m_index) {
                                // 다음 함수에 삭제 메시지 전달하기 위해 변수 변경
                                inResult = true;
                            }
                            // 없으면
                            else {
                                // 에러 메시지 호출 후 종료.
                                socket.emit('getOutRoomFront', false);
                            }
                        }
                        // 다음 함수로 확인 결과 및 m_index, joinedMember 전달
                        callback(null, inResult, m_index, joinedMember);
                    }
                });
            },
            // 확인이 되었으면 삭제한다.
            function (identifyResult, m_index, joinedMember, callback) {
                // joinedMember에 ID가 있을 경우 아이디를 삭제
                if (identifyResult == true) {
                    // 삭제의 방법은 joinedMember에서 해당 m_index에 해당하는 값만 pop시킨다.
                    joinedMember.memList.pop(m_index);
                    // Update 쿼리
                    var updateMemQuery = "UPDATE ChatList SET joinedMember = ? WHERE r_index = ?";
                    db.query(updateMemQuery, [joinedMember, rindex], function (err, updateMemResult) {
                        if (err) {
                            // 에러 메시지 출력 후 종료.
                            console.log("update joinedmember query error : " + err);
                            socket.emit('getOutRoomFront', false);
                        } else {
                            // 업데이트 결과 출력
                            console.log("update joinedmember query result : " + updateMemResult);
                            // 마지막 함수에 true를 전달
                            callback(null, true);
                        }
                    });
                }
                // 아이디가 없을 경우 에러 처리
                else {
                    socket.emit('getOutRoomFront', false);
                }
            }
        ],
            function (err, result) {
                if (result == true) {
                    socket.emit('getOutRoomFront', true);
                } else {
                    socket.emit('getOutRoomFront', false);
                }
            });
    });
}
// Function name : addNewFriend2
// Descritpion : add New friend function
// Input : memberID, friends List
// Output : update success list
// Author : Hanbyul kang
function AddNewFriend(socket) {
    socket.on('addNewFriend2', async function (friendData) {
        var parsedData = JSON.parse(friendData);
        var memID = parsedData.memID;
        var out_m_index;// friendList 테이블 업데이트용 m_index        
        var friendCount;// frinedlist 테이블에서 number를 업데이트 하기 위한 변수

        try {
            const checkIdQuery = "SELECT m_index FROM MemberInfo WHERE memID = $1;";
            const checkIdResult = await client.query(checkIdQuery, [memID]);
            const loginUserMemIndex = checkIdResult.rows[0].m_index;

            // 아이디가 등록되어 있으면 fList를 m_index를 사용해 FriendList 테이블에서 가져온다.
            // 아이디가 등록되어 있지 않으면 FriendList에 m_index를 사용해 등록한다.            
            const getFListQuery = "SELECT fList FROM FriendList WHERE m_index = $1;";
            const getFListResult = await client.query(getFListQuery, [loginUserMemIndex]);
            var temp = getFListResult.rows[0].flist;
            let existFriendList = JSON.parse(temp);
            var friendCount = existFriendList.number;

            // 친구의 m_index를 불러온다.
            var getFriendInfoQuery = "SELECT m_index FROM MemberInfo WHERE memID = $1;";
            var friendId = parsedData.fList;// 추가하고자 하는 친구 이름            
            const friendInfoResult = await client.query(getFriendInfoQuery, [friendId]);
            const friendInfo = friendInfoResult.rows[0];

            // 아이디 체크 // 아이디가 아예 없는 지 / 기존에 있는 아이디인지 / 자기 자신인지 체크
            for (var i = 0; i < existFriendList.flist.length; i++) {
                if (friendInfo.length == 0 || existFriendList.flist[i] == friendInfo.m_index || friendInfo.m_index == out_m_index)
                    socket.emit('addNewFriend2', 'false');
            }

            // fList를 기존에 있던 내용에서 새로운 내용으로 업데이트 한다.
            existFriendList.flist.push(friendInfo.m_index);
            friendCount += 1;
            existFriendList.number = friendCount;
            let newFriendList = JSON.stringify(existFriendList);
            var updateDBQuery = "UPDATE FriendList SET fList = $1 WHERE m_index = $2;";
            const zadfasResult = await client.query(updateDBQuery, [newFriendList, loginUserMemIndex]);

            socket.emit('addNewFriend2', 'true');

        } catch (error) {
            console.log(error);
            socket.emit('addNewFriend2', 'false');
        }
    });
}

async function UserExist(memId) {
    try {
        var existQuery = "SELECT count(*) exist FROM MemberInfo WHERE memID = $1";
        var existParam = [memId];

        const result = await client.query(existQuery, existParam);
        const resultRows = result.rows;
        const isExist = resultRows && resultRows[0] ? Number(resultRows[0].exist) : 0;

        if (isExist == 1) {
            return true;
        } else {
            return false;
        }

    } catch (error) {
        console.log(error);
    }

    return false;
}

// Function name : getUserInfo
// Descritpion : get information of the user
// Input : user id
// Output : information of the user
// Author : Hyunyi Kim
function GetUserInfo(socket) {
    socket.on('getUserInfo', async function (data, callback) {
        var userId = data;
        try {
            const isExist = await UserExist(userId);
            if (!isExist)
                socket.emit('getUserInfoResult', { userInfo: 'none' });

            var query = "SELECT memId, nickname nickname, photo photo, personalSetting settings FROM MemberInfo WHERE memID = $1";
            var param = [userId];

            const result = await client.query(query, param);
            const resultRows = result.rows;
            socket.emit('getUserInfoResult', { userInfo: resultRows });
        } catch (error) {
            console.log(error);
        }
    });
}

//Function name : getFriends
//Descritpion : get list of friends of the user from DB
//Input : socket
//Output : list of friends
//Author : Hyunyi Kim
function GetFriends(socket) {
    socket.on('checkFriends', async function (data, callback) {
        try {
            var userId = data;
            var query = "SELECT fList FROM FriendList WHERE memID = $1";
            var result = await client.query(query, [userId]);
            var number = result.rows.length;
            if (number > 0) {
                const fList = result.rows[0].flist;
                var list = "";
                var data = JSON.parse(fList)
                for (var i = 0; i < data.number; i++) {
                    list += data.flist[i];
                    if (i != data.number - 1)
                        list += ", ";
                }

                const memberListQuery = "SELECT m_index,memID,nickname,photo FROM MemberInfo WHERE m_index in (" + list + ")";
                const memListResult = await client.query(memberListQuery);
                const memList = memListResult.rows[0];
                socket.emit('checkFriendsResult', { friendList: [memList] });
                return;
            }
        } catch (error) {
            socket.emit('checkFriendsResult', { friendList: false });
        }

        socket.emit('checkFriendsResult', { friendList: false });
    });
}

//Function name  : changeNickname
//Description : change the nickname of the user
//input : user id and nickname that the user inputs
//output : JSON data ({success : true})
//Author : Hyunyi Kim
function ChangeNickname(socket) {
    socket.on('changeNickname', async function (data, callback) {
        try {
            var userId = JSON.parse(data).memID;
            var input = JSON.parse(data).newNick;
            var query = "UPDATE MemberInfo SET nickname = $1 WHERE memID = $2";
            const updateNickNameResult = await client.query(query, [input, userId]);
            socket.emit('changeNicknameResult', { success: true });
            return;
        } catch (error) {
            console.log(error);
        }
        socket.emit('changeNicknameResult', { success: false });
    });
}

//Function name  : checkPassword
//Description : check if user's input is as same as existing password
//input : user id and existing password that user inputs
//output : true or false
//Author : Hyunyi Kim
async function CheckEqualPassword(data) {
    var userId = JSON.parse(data).memID;
    var existing = JSON.parse(data).newPw;
    var existingPw = encryptPw(existing);
    var compareQuery = "SELECT count(*) AS exist FROM MemberInfo WHERE memID = $1 AND $2 = (SELECT memPW FROM MemberInfo WHERE memID = $3)";
    const compareResult = await client.query(compareQuery, [userId, existingPw, userId]);
    const isExist = compareResult.rows[0].exist;

    return isExist == 1;
}

//Function name  : changePassword
//Description : change the password of the user
//input : user id and password that the user inputs
//output : JSON data ({success : true},{success : false})
//Author : Hyunyi Kim
function ChangePassword(socket) {
    socket.on('changePassword', async function (data) {
        try {
            const isEqualPassword = await CheckEqualPassword(data);
            if (isEqualPassword) {
                socket.emit('changePasswordResult', { success: false });
                return;
            }
            var userId = JSON.parse(data).memID;
            var input = JSON.parse(data).newPw;
            var newPasswd = encryptPw(input);
            var query = "UPDATE MemberInfo SET memPW = $1 WHERE memID = $2";
            const updatePasswordResult = await client.query(query, [newPasswd, userId]);

            socket.emit('changePasswordResult', { success: true });
            return;
        } catch (error) {
            console.log(error);
        }
        socket.emit('changePasswordResult', { success: false });
    });
}

//Function name  : updatePhoto
//Description : change user's photo
//input : mem_idimage_url
//output : JSON data ({success : true})
//Author : Hyunyi Kim
function updatePhoto(socket) {
    socket.on('updatePhoto', function (data) {
        var userId = data.memID;
        var input = data.newURL;
        console.log(userId);
        console.log(input);
        var query = "UPDATE `MemberInfo` SET `photo`= ? WHERE `memID` = ?";
        db.query(query, [input, userId], function (err) {
            console.log(query);
            if (err) {
                console.log(false);
                socket.emit('updatePhotoResult', { success: false });
            } else {
                console.log(true);
                socket.emit('updatePhotoResult', { success: true });
            }
        });
    });
}

//Function name  : updateSettings
//Description : save user's settings
//input : settings and memId
//output : JSON data ({success : true})
//Author : Hyunyi Kim
function UpdateSettings(socket) {
    socket.on('updateSettings', async function (memID, settings) {
        try {
            var userId = memID;
            var input = JSON.stringify(settings);

            var query = "UPDATE MemberInfo SET personalSetting = $1 WHERE memID = $2";
            const updateSettingResult = await client.query(query, [input, userId]);

            socket.emit('updateSettingsResult', { success: true });
            return;
        } catch (error) {
            console.log("에러", error);
        }
        socket.emit('updateSettingsResult', { success: false });
    });
}

//Function name  : joinRoom
//Description : enter the selected chatting room
//input : memID and room_name
//output :
//Author : Hyunyi Kim
function JoinRoom(socket) {
    socket.on('joinRoom', async function (memID, r_index) {
        var userId = memID;
        try {
            var pre_r_index = CURRENT_ROOM[socket.id];

            if (CHAT_LIST.length > 0 && CHAT_LIST[pre_r_index].length > 0) {
                tmp = CHAT_LIST[pre_r_index];
                for (var i in tmp)
                    str += tmp[i] + ',';
                str = str.substring(0, str.lastIndexOf(","));
                var sentence = '{"number":' + tmp.length + ',"message":' + '[' + str + ']}';

                const insertChatContentQuery = "INSERT INTO ChatContentList(chatMsgList, r_index) VALUES ($1, $2)";
                await client.query(insertChatContentQuery, [sentence, pre_r_index]);

                tmp = new Array();
                CHAT_LIST = new Array();
                str = '';
            }

            if (CURRENT_ROOM[socket.id] == null) {
                socket.join(r_index);
                CURRENT_ROOM[socket.id] = r_index;
            } else {
                socket.leave(CURRENT_ROOM[socket.id]);
                socket.join(r_index);
                CURRENT_ROOM[socket.id] = r_index;
            }

            var getRoomInfoQuery = "SELECT r_index, roomName FROM RoomList WHERE r_index = $1";
            const getRoomInfoResult = await client.query(getRoomInfoQuery, [r_index]);
            const chatlistRow = getRoomInfoResult.rows[0];

            var usersInRoom = io.sockets.clients(r_index);

            if (usersInRoom.length >= 1) {
                var usersInRoomSummary = 'Users currently in ' + r_index + ': ';
                for (var index in usersInRoom) {
                    var userSocketId = usersInRoom[index].id;
                    if (index > 0) {
                        usersInRoomSummary += ', ';
                        usersInRoomSummary += userSocketId;
                    }
                    usersInRoomSummary += '.';
                }
            }

            var getChatContentQuery = "SELECT chatMsgList FROM ChatContentList WHERE r_index = $1";
            const chatContentResult = await client.query(getChatContentQuery, [r_index]);
            const chatList = chatContentResult.rows[0];

            for (var i in chatList) {
                var obj = JSON.parse(chatList[i].chatMsgList);
                for (var j = 0; j < obj.number; j++) {
                    var toJSON = JSON.stringify(obj.message[j].msg);
                    obj.message[j].msg = encryption.decodeMessage(toJSON);
                }
                chatList[i].chatMsgList = JSON.stringify(obj);
            }
            var rows = result;
            for (var i in rows) {
                var obj = JSON.parse(rows[i].chatMsgList);
                for (var j = 0; j < obj.number; j++) {
                    prevMessage(socket, r_index, j, obj);
                }
            }

            // decodeMessage(chatlistRow, function (result) {
            // });

            socket.emit('joinRoomResult', { success: true, r_index: results[0].r_index, roomName: results[0].roomName });
            return;
        } catch (error) {
            console.log(error);
        }
        socket.emit('joinRoomResult', { success: false });
    });
}

function prevMessage(socket, r_index, j, obj) {
    var photo = getPicture(socket, obj.message[j].sender, function (data) {
        socket.emit('message', {
            sender: obj.message[j].sender, nick: obj.message[j].nick, text: obj.message[j].msg, r_index: r_index, pic: data, time: obj.message[j].time
        });
    });
}

function decodeMessage(rows, callback) {
    for (var i in rows) {
        var obj = JSON.parse(rows[i].chatMsgList);
        for (var j = 0; j < obj.number; j++) {
            var toJSON = JSON.stringify(obj.message[j].msg);
            obj.message[j].msg = encryption.decodeMessage(toJSON);
        }
        rows[i].chatMsgList = JSON.stringify(obj);
    }
    callback(rows);
}

//Function name : getChatRoom
//Descritpion : get list of chatroom stored in DB
//Input : socket
//Output : list of chatRoom
//Author : Hyunyi Kim
function GetChatRoom(socket) {
    socket.on('getChatRoom', async function (data, callback) {
        var userId = data;
        try {
            var query = "SELECT r_indexList FROM MemberInfo WHERE memID = $1";
            const selectResult = await client.query(query, [userId]);
            const rawInfo = selectResult.rows[0];
            const memberChatList = JSON.parse(rawInfo.r_indexlist);
            // var number = Number(memberChatList.num);
            let list = memberChatList.rIndexList;

            if (!Array.isArray(list))
                throw exception;

            let whereString = "";
            for (var i = 0; i < list.length; i++) {
                whereString += list[i];
                if (i != list.length - 1)
                    whereString += ", ";
            }

            var chatListQuery = "SELECT r_index, roomName FROM RoomList"
            if (whereString)
                chatListQuery += " WHERE r_index in (" + whereString + ")";

            const rawChatList = await client.query(chatListQuery);
            const chatRoomList = rawChatList.rows;

            socket.emit('getChatRoomResult', { chatRoomList: chatRoomList });
            return;
        } catch (error) {
            console.log(error);
            socket.emit('getChatRoomResult', { chatRoomList: false });
        }
        socket.emit('getChatRoomResult', { chatRoomList: false });
    });
}


//메세지와 보낸 사람을 정해진 형태의 문자열로 만들어 배열(chatList)에 저장
function messageFormat(msg, sender, nick, r_index) {
    CHAT_LIST[r_index].push('{"time":"' + sendedTime() + '","msg":' + encryption.encodeMessage(msg) + ',"sender":"' + sender + '","nick":"' + nick + '"}');
}

//Function name  : handleMessageProcess
//Description : handle saving sended message and sending passed message
//input :{sender : 김현이, room: 21, text: "message"}
//output : {success : true}, {success : false}
//Author : Hyunyi Kim
function handleMessageProcess(socket) {
    socket.on('message', function (message) {
        var time = sendedTime();
        console.log('sendedTime is ' + time);
        console.log('enter the message_process');
        console.log(message);
        console.log('In this time, r_index : ' + message.room);
        if (typeof (CHAT_LIST[message.room]) == 'undefined') {
            CHAT_LIST[message.room] = new Array();
        }
        console.log('In this time, r_index : ' + message.room);
        var escaped = escape(message.text);
        console.log(escaped);
        //메세지(msg)를 {"time":"메세지 송신 시간","msg":"메세지 내용","sender":"보낸 사람"} 형태로 배열에 저장
        messageFormat(escaped, message.sender, message.nick, message.room)
        console.log('In this time, r_index : ' + message.room);
        console.log(CHAT_LIST[message.room]);
        console.log(CHAT_LIST[message.room].length);
        //{"number":메세지 갯수,"message":[{msg},{msg},{msg},{msg},.....,{msg}]}형태의 문자열을 DB에 저장
        if (CHAT_LIST[message.room].length == 20) {
            console.log('I gather the 20 data');
            console.log('In this time, r_index : ' + message.room);
            tmp = CHAT_LIST[message.room];
            //배열의 원소들을 하나의 문자열로 결합
            for (var i in tmp)
                str += tmp[i] + ',';
            str = str.substring(0, str.lastIndexOf(","));
            //DB에 저장할 형태로 변경
            var sentence = '{"number":' + tmp.length + ',"message":' + '[' + str + ']}';
            //data1 : 가장 오래된 메세지의 송신 시각 , data2 : 문자열(메세지들)
            //------------------------------------------------------//
            console.log('In this time, r_index : ' + message.room);
            db.query('INSERT INTO `ChatContentList`(`chatMsgList`, `r_index`) VALUES (?,?)',
                [sentence, message.room], function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('success > the number of data is 20');
                        //변수 초기화
                        tmp = new Array();
                        CHAT_LIST[message.room] = new Array();
                        str = '';
                    }
                });
        }

        var photo = getPicture(socket, message.sender, function (data) {
            console.log(data);
            socket.broadcast.to(message.room).emit('message', {
                sender: message.sender, nick: message.nick, text: message.text, r_index: message.room, pic: data, time: time
            });
        });
    });
}

function sendMessage(socket, message, picture, time) {
    console.log(message);
    console.log(picture);
    console.log(time);
    var query = "SELECT `nickname` FROM `MemberInfo` WHERE `memID` = ?";
    db.query(query, [message.sender], function (err, row) {
        if (err)
            console.log(err);
        else {
            socket.broadcast.to(message.room).emit('message', {
                sender: message.sender, nick: message.nick, text: message.text, r_index: message.room, pic: picture, time: time
            });
        }
    });
}




function getPicture(socket, memID, callback) {
    var query = "SELECT `photo` FROM `MemberInfo` WHERE `memID` = ?";
    db.query(query, [memID], function (err, row) {
        console.log(row);
        console.log(row[0]);
        console.log(row[0].photo);
        callback(row[0].photo);
    });
}

function handleClientDisconnectionProcess(socket) {
    socket.on('disconnect', function () {
        //메세지 20개가 쌓이기 전-채팅방에 접속해 있던 사람이 접속해제를 할때, chatList에 저장되어 있는 메세지를 DB에 저장
        var r_index = CURRENT_ROOM[socket.id];
        console.log(r_index);
        if (typeof (r_index) == 'undefined') {
            return;
        }

        if (CHAT_LIST.length > 0 && typeof (CHAT_LIST[r_index]) != 'undefined' && CHAT_LIST[r_index].length > 0) {
            tmp = CHAT_LIST[r_index];
            for (var i in tmp)
                str += tmp[i] + ',';
            str = str.substring(0, str.lastIndexOf(","));
            var sentence = '{"number":' + tmp.length + ',"message":' + '[' + str + ']}';
            db.query('INSERT INTO `ChatContentList`(`chatMsgList`, `r_index`) VALUES (?,?)',
                [sentence, r_index], function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('success > the number of data is ' + tmp.length);
                        tmp = new Array();
                        CHAT_LIST = new Array();
                        str = '';

                    }
                });

        }
    });
}

