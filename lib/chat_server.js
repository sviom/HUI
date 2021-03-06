var socketio = require('socket.io');
var IO_GLOBAL;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var CURRENT_ROOM = {};
var CHAT_LIST = new Array(); //송신 되는 메세지들을 저장하기 위한 변수

var encryption = require('./encode_msg.js');
var crypto = require('crypto');
const pg = require('pg');
const dbConfig = require('../Database/dbConfig.json');
const { exception } = require('console');

const config = process.env.NODE_ENV ? dbConfig.Production : dbConfig.Dev;
const client = new pg.Client(config);
client.connect(err => {
    if (err)
        console.error(err);
    else
        console.log("SUCCESS!!!!!!!!!!!");
});

//Socket.IO 서버를 시작하고  Socket.IO가 콘솔에 출력하는 로깅을 제한하며 유입되는 연결을 처리 -->
exports.listen = function (server) {
    IO_GLOBAL = socketio.listen(server);
    // io.set('log level', 1);

    // let testSocket = await socketAsync.SocketsOnAsync(io, 'connection');

    IO_GLOBAL.sockets.on('connection', function (socket) {
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
        JoinRoom(socket);
        InviteNewFriend(socket);
        MessageHandleProcess(socket);
        HandleClientDisconnectionProcess(socket);
        UpdatePhoto(socket);
        LeaveRoom(socket);
        return;

        // 채팅방 버튼 클릭 이벤트가 발생 하였을 때
        //handleRoomJoining(socket);

        // guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed); //사용자 접속시 손님 닉네임 부여
        // joinRoom(socket, 'Lobby'); //사용자가 접속하면 대기실로 이동
        // handleMessageBroadcasting(socket, nickNames); //메세지 처리
        // handleNameChangeAttempts(socket, nickNames, namesUsed); //닉네임 변경 처리

        // //이미 생성된 채팅방 목록을 사용자에게 제공
        // socket.on('rooms', function() {
        //  socket.emit('rooms', io.sockets.manager.rooms);
        // });

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

//채팅방 만들기 처리
function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(CURRENT_ROOM[socket.id]); //현재 있던 방에서 나옴
        JoinRoom(socket, room.newRoom); //이미 만들어진 채팅방이나 새로운 채팅방을 만듦
    });
}

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
function GetSendedTime() {
    var now = new Date();
    return (now.toDateString() + " " + now.getHours() + ':'
        + ((now.getMinutes() < 10) ? ("0" + now.getMinutes()) : (now.getMinutes())));
}

//'시:분:초'형태로 반환
Date.prototype.getTime = function () {
    return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":"
        + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
}

//XSS공격 방지(ASCII문자를 동일한 의미의 HTML문자로 변경)
function escape(message) {
    message = message.toString();
    var escaped = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped;
}

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
        try {
            var parsedRawData = JSON.parse(newFriendData);

            var inMemID = parsedRawData.memID;
            var friendMemId = parsedRawData.friendName;
            var r_index = parsedRawData.r_index;

            var friendIndexQuery = "SELECT m_index FROM MemberInfo WHERE memID = $1;";
            const friendIndexResult = await client.query(friendIndexQuery, [friendMemId]);
            const friendMIndex = friendIndexResult.rows[0].m_index;

            var getJoinedMemberQuery = "SELECT joinedMem FROM RoomList WHERE r_index = $1;";
            const joinedMemberResult = await client.query(getJoinedMemberQuery, [r_index]);
            const joinedMember = JSON.parse(joinedMemberResult.rows[0].joinedmem);

            let existMemNum = joinedMember.memNum;      // 현재 joinedMember의 친구 수            
            existMemNum += 1;

            let existMemList = joinedMember.memList;    // 현재 memList
            if (Array.isArray(existMemList))
                existMemList.push(friendMIndex);

            let newJoinedMembers = JSON.stringify({ memNum: existMemNum, memList: existMemList });

            var updateJoinedMemberQuery = "UPDATE RoomList SET joinedMem = $1 WHERE r_index = $2;";
            await client.query(updateJoinedMemberQuery, [newJoinedMembers, r_index]);

            var selectList = "SELECT r_indexList FROM MemberInfo WHERE m_index = $1";
            const rIndexListResult = await client.query(selectList, [friendMIndex]);

            var friendRoomIndexList = JSON.parse(rIndexListResult.rows[0].r_indexlist);

            if (Array.isArray(friendRoomIndexList.rIndexList))
                friendRoomIndexList.rIndexList.push(r_index);
            friendRoomIndexList.num += 1;

            var tempString = JSON.stringify(friendRoomIndexList);
            var updateIndexQuery = "UPDATE MemberInfo SET r_indexList = $1 WHERE m_index = $2";
            await client.query(updateIndexQuery, [tempString, friendMIndex]);

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
function LeaveRoom(socket) {
    socket.on('getOutRoom', async function (data, callback) {
        try {
            var memId = data.memId;
            var roomIndex = data.roomIndex;

            var memberIndexQuery = "SELECT m_index, r_indexlist FROM MemberInfo WHERE memID = $1";
            const memberInfoResult = await client.query(memberIndexQuery, [memId]);
            const memberIndex = memberInfoResult.rows[0].m_index;
            const roomIndexList = JSON.parse(memberInfoResult.rows[0].r_indexlist);

            if (roomIndexList.rIndexList && Array.isArray(roomIndexList.rIndexList))
                roomIndexList.rIndexList.splice(roomIndexList.rIndexList.indexOf(roomIndex), 1);

            roomIndexList.num -= 1;

            let rooinIndexListString = JSON.stringify(roomIndexList);

            var updateIndexQuery = "UPDATE MemberInfo SET r_indexList = $1 WHERE m_index = $2;";
            await client.query(updateIndexQuery, [rooinIndexListString, memberIndex]);

            var selectJoinedMemberQuery = "SELECT joinedmem FROM RoomList WHERE r_index = $1";
            const joinedMemberResult = await client.query(selectJoinedMemberQuery, [roomIndex]);
            let joinedMem = JSON.parse(joinedMemberResult.rows[0].joinedmem);

            if (joinedMem.memList && Array.isArray(joinedMem.memList))
                joinedMem.memList.splice(joinedMem.memList.indexOf(memberIndex), 1);

            joinedMem.memNum -= 1;

            if (joinedMem.memNum != 0 && joinedMem.memList.length != 0) {
                let joinedMemString = JSON.stringify(joinedMem);
                var updateMemQuery = "UPDATE RoomList SET joinedmem = $1 WHERE r_index = $2";
                const joinedMemberResult = await client.query(updateMemQuery, [joinedMemString, roomIndex]);
            } else {
                // 만약에 아무도 없는 방이면 폭파
                const deleteRoomQuery = "DELETE FROM RoomList WHERE r_index = $1";
                const deleteResult = await client.query(deleteRoomQuery, [roomIndex]);
            }

            CURRENT_ROOM = {};
            socket.emit('getOutRoomFront', true);
            return;
        } catch (error) {
            console.error(error);
        }
        socket.emit('getOutRoomFront', false);
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
                if (friendInfo.length == 0 || existFriendList.flist[i] == friendInfo.m_index || friendInfo.m_index == out_m_index) {
                    socket.emit('addNewFriend2', 'false');
                    return;
                }
            }

            // fList를 기존에 있던 내용에서 새로운 내용으로 업데이트 한다.
            existFriendList.flist.push(friendInfo.m_index);
            friendCount += 1;
            existFriendList.number = friendCount;
            let newFriendList = JSON.stringify(existFriendList);
            var updateDBQuery = "UPDATE FriendList SET fList = $1 WHERE m_index = $2;";
            const zadfasResult = await client.query(updateDBQuery, [newFriendList, loginUserMemIndex]);

            socket.emit('addNewFriend2', 'true');
            return;
        } catch (error) {
            console.error(error);
        }
        socket.emit('addNewFriend2', 'false');
    });
}

async function UserExist(memId) {
    try {
        var existQuery = "SELECT count(*) exist FROM MemberInfo WHERE memID = $1";
        var existParam = [memId];

        const result = await client.query(existQuery, existParam);
        const resultRows = result.rows;
        const isExist = resultRows && resultRows[0] ? Number(resultRows[0].exist) : 0;

        if (isExist == 1) return true;
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
function UpdatePhoto(socket) {
    socket.on('updatePhoto', async function (data) {
        try {
            var userId = data.memID;
            var input = data.newURL;

            var query = "UPDATE MemberInfo SET photo = $1 WHERE memID = $2";
            const photoResult = await client.query(query, [input, userId]);

            socket.emit('updatePhotoResult', { success: true });
            return;
        } catch (error) {
            console.error(error);
        }
        socket.emit('updatePhotoResult', { success: false });
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

            if (CHAT_LIST && CHAT_LIST.length > 0 && pre_r_index && CHAT_LIST[pre_r_index].length > 0) {
                await InsertChatList(pre_r_index);
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
            const roomListRow = getRoomInfoResult.rows[0];
            const roomName = roomListRow.roomname;
            const roomIndex = roomListRow.r_index;

            // var usersInRoom = IO_GLOBAL.sockets.clients(r_index);

            // if (usersInRoom.length >= 1) {
            //     var usersInRoomSummary = 'Users currently in ' + r_index + ': ';
            //     for (var index in usersInRoom) {
            //         var userSocketId = usersInRoom[index].id;
            //         if (index > 0) {
            //             usersInRoomSummary += ', ';
            //             usersInRoomSummary += userSocketId;
            //         }
            //         usersInRoomSummary += '.';
            //     }
            // }

            socket.emit('joinRoomResult', { success: true, r_index: roomIndex, roomName: roomName });

            var getChatContentQuery = "SELECT chatMsgList FROM ChatContentList WHERE r_index = $1";
            const chatContentResult = await client.query(getChatContentQuery, [r_index]);
            const chatList = chatContentResult.rows;
            if (chatList) {
                // for (var i in chatList) {
                //     var obj = JSON.parse(chatList[i].chatmsglist);
                //     for (var j = 0; j < obj.number; j++) {
                //         var toJSON = JSON.stringify(obj.message[j].msg);
                //         obj.message[j].msg = encryption.decodeMessage(toJSON);
                //     }
                //     chatList[i].chatMsgList = JSON.stringify(obj);
                // }

                for (var i in chatList) {
                    var obj = JSON.parse(chatList[i].chatmsglist);
                    for (var j = 0; j < obj.number; j++) {
                        await prevMessage(socket, r_index, j, obj);
                    }
                }
            }
            return;
        } catch (error) {
            console.log(error);
        }
        socket.emit('joinRoomResult', { success: false });
    });
}

async function prevMessage(socket, r_index, j, obj) {
    const data = await GetMemeberPhoto(obj.message[j].sender);

    let message = JSON.parse(obj.message[j]);

    socket.emit('message', {
        sender: message.sender,
        nick: message.nick,
        text: message.msg,
        r_index: r_index,
        pic: data,
        time: message.time
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

//Function name  : MessageHandleProcess
//Description : handle saving sended message and sending passed message
//input :{sender : 김현이, room: 21, text: "message"}
//output : {success : true}, {success : false}
//Author : Hyunyi Kim
function MessageHandleProcess(socket) {
    socket.on('message', async function (message) {
        try {
            var sendedTime = GetSendedTime();

            if (typeof (CHAT_LIST[message.room]) == 'undefined')
                CHAT_LIST[message.room] = new Array();

            var escaped = escape(message.text);

            //메세지(msg)를 {"time":"메세지 송신 시간","msg":"메세지 내용","sender":"보낸 사람"} 형태로 배열에 저장
            var temp = {
                time: sendedTime,
                msg: escaped,
                sender: message.sender,
                nick: message.nick
            };
            let tempString = JSON.stringify(temp);
            CHAT_LIST[message.room].push(tempString);

            //{"number":메세지 갯수,"message":[{msg},{msg},{msg},{msg},.....,{msg}]}형태의 문자열을 DB에 저장
            const insertResult = await InsertChatList(message.room);
            if (!insertResult)
                throw exception("Insert error");

            const photo = await GetMemeberPhoto(message.sender);
            socket.broadcast.to(message.room).emit('message', {
                sender: message.sender,
                nick: message.nick,
                text: message.text,
                r_index: message.room,
                pic: photo,
                time: sendedTime
            });
        } catch (error) {
            console.error(error);
        }
    });
}

async function GetMemeberPhoto(memID) {
    try {
        var query = "SELECT photo FROM MemberInfo WHERE memID = $1";
        const result = await client.query(query, [memID]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return row.photo;
        }

        return null;
    } catch (error) {
        console.error(error);
    }
}

function HandleClientDisconnectionProcess(socket) {
    socket.on('disconnect', async function () {
        try {
            var r_index = CURRENT_ROOM[socket.id];
            const insertResult = await InsertChatList(r_index);
        } catch (error) {
            console.error(error);
        }
    });
}

async function InsertChatList(roomIndex = -1) {
    try {
        if (!roomIndex || roomIndex == -1)
            return false;

        if (CHAT_LIST.length <= 0 || typeof (CHAT_LIST[roomIndex]) == 'undefined' || CHAT_LIST[roomIndex].length <= 0)
            return false;

        let currentChatList = CHAT_LIST[roomIndex];

        let tempSentence = {
            number: 0,
            message: [],
        };

        for (var i in currentChatList) {
            tempSentence.message.push(currentChatList[i]);
        }
        tempSentence.number = currentChatList.length;

        //DB에 저장할 형태로 변경
        var sendedTime = GetSendedTime();
        var sentence = JSON.stringify(tempSentence);

        const insertChatQuery = 'INSERT INTO ChatContentList(chatMsgList, r_index, chattime) VALUES ($1, $2, $3)';
        await client.query(insertChatQuery, [sentence, roomIndex, sendedTime]);

        CHAT_LIST[roomIndex] = new Array();
        return true;
    } catch (error) {
        console.error(error);
    }
    return false;
}