DROP TABLE IF EXISTS roomlist cascade;
CREATE TABLE roomlist (
  r_index SERIAL primary key,
  -- roomId integer not null unique,
  joinedMem varchar(2000) NOT NULL DEFAULT '{ }',
  roomName varchar(100) NOT NULL
);

DROP TABLE IF EXISTS chatcontentlist cascade;
CREATE TABLE chatcontentlist (
  r_index SERIAL references roomlist(r_index),
  -- roomId INTEGER NOT null unique references roomlist(roomid),
  chatTime VARCHAR(50) NOT NULL,
  chatMsgList VARCHAR(20000) NOT NULL DEFAULT '{ }'
);

DROP TABLE IF EXISTS memberinfo cascade;
CREATE TABLE memberinfo (
  m_index serial primary key,
  memID varchar(255) NOT null unique,
  memPW varchar(500) NOT NULL,
  nickname varchar(20) NOT NULL,
  photo varchar(20000) DEFAULT NULL,
  personalSetting varchar(300) NOT NULL DEFAULT '{ }',
  r_indexList varchar(500) DEFAULT '{"num": 0}'  
  
);

DROP TABLE IF EXISTS chatlist cascade;
CREATE TABLE chatlist (
  m_index SERIAL primary key references memberinfo(m_index),
  -- roomID varchar(500) NOT null unique,
  chatList varchar(20000) NOT NULL DEFAULT '{ }'
);

DROP TABLE IF EXISTS friendlist cascade;
CREATE TABLE friendlist (
  m_index SERIAL primary key references memberinfo(m_index),
  memId varchar(255) NOT null unique references memberinfo(memid),
  fList varchar(20000) NOT NULL DEFAULT '{"number": 0, "list": { } }'  
);

DROP TABLE IF EXISTS userparticipatelist cascade;
CREATE TABLE userparticipatelist (
  m_index serial primary key references memberinfo(m_index),
  userID varchar(50) NOT NULL,
  participateList varchar(20000) NOT NULL DEFAULT '{ }'
);

INSERT INTO "memberinfo" VALUES (24,'jeta','160efd3faadf4ec245d6313806e03deb335d2fde71ae93b2d89e54e9f1ac9025','jETA','null','{\"Alert\":{\"DesktopAlert\":true,\"MessagePreview\":false,\"AlertWithSound\":true},\"General\":{\"SendType\":0}}','\"{num: 0}\"'),(26,'test','293899b2e2eb8889e42fa0d13050f7b6df45d24f32d7acf36b9506a1517771ad','test','null','{\"Alert\":{\"DesktopAlert\":true,\"MessagePreview\":false,\"AlertWithSound\":true},\"General\":{\"SendType\":0}}','\"{num: 0}\"');
INSERT INTO "friendlist" VALUES (24,'jeta','{"number": 0, "list": { } }'),(26,'test','{"number": 0, "list": { } }');
