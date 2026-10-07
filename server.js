const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const client = process.env.OPENAI_API_KEY ? new OpenAI({apiKey: process.env.OPENAI_API_KEY}) : null;
const rooms = new Map();

function code(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let x="";for(let i=0;i<5;i++)x+=chars[Math.floor(Math.random()*chars.length)];return x;}
function publicRoom(r){return {code:r.code,question:r.question,questionNumber:r.questionNumber,questionCount:r.questions.length,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,answered:p.answered}))};}
function sendRoom(r){io.to(r.code).emit("room:update",publicRoom(r));}

async function gradeWithAI(question, solution, answer){
  if(!client) return null;
  const prompt = `Du bist ein fairer deutscher Schul-Korrektor.
Bewerte die Schülerantwort anhand der Frage und Musterlösung.
Akzeptiere sinngemäß richtige Antworten, auch wenn sie anders formuliert sind.
Bewerte Teilwissen fair.
Gib NUR gültiges JSON zurück: {"points":0-100,"feedback":"kurzes Feedback auf Deutsch"}.
Frage: ${question}
Musterlösung: ${solution}
Schülerantwort: ${answer}`;
  try{
    const response = await client.responses.create({
      model: "gpt-6-luna",
      input: prompt
    });
    const raw = response.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    const result = JSON.parse(raw);
    return {
      points: Math.max(0,Math.min(100,Math.round(Number(result.points)||0))),
      feedback: String(result.feedback||"Bewertet.")
    };
  }catch(e){
    console.error("KI-Korrektur:",e.message);
    return null;
  }
}

io.on("connection", socket=>{
  socket.on("teacher:create",()=>{
    let c;do c=code();while(rooms.has(c));
    const r={code:c,teacher:socket.id,questions:[],current:-1,question:null,questionNumber:0,players:new Map()};
    rooms.set(c,r);socket.join(c);socket.room=c;socket.emit("teacher:created",publicRoom(r));
  });

  socket.on("teacher:addQuestion",({code:c,text,solution})=>{
    const r=rooms.get(c);if(!r||r.teacher!==socket.id)return;
    if(!text?.trim())return;
    r.questions.push({text:text.trim(),solution:(solution||"").trim()});
    sendRoom(r);
  });

  socket.on("teacher:start",({code:c,index})=>{
    const r=rooms.get(c);if(!r||r.teacher!==socket.id||!r.questions[index])return;
    r.current=index;r.question=r.questions[index].text;r.questionNumber=index+1;
    for(const p of r.players.values())p.answered=false;
    io.to(c).emit("question:started",{text:r.question,number:r.questionNumber,total:r.questions.length});
    sendRoom(r);
  });

  socket.on("student:join",({code:c,name})=>{
    const r=rooms.get(String(c||"").toUpperCase());
    if(!r)return socket.emit("error:msg","Raum nicht gefunden.");
    const clean=String(name||"").trim().slice(0,30);
    if(!clean)return socket.emit("error:msg","Bitte Namen eingeben.");
    r.players.set(socket.id,{id:socket.id,name:clean,score:0,answered:false});
    socket.join(r.code);socket.room=r.code;
    socket.emit("student:joined",{code:r.code,name:clean});
    sendRoom(r);
    if(r.question)socket.emit("question:started",{text:r.question,number:r.questionNumber,total:r.questions.length});
  });

  socket.on("student:answer",async({code:c,answer})=>{
    const r=rooms.get(c),p=r?.players.get(socket.id);
    if(!r||!p||r.current<0||p.answered)return;
    p.answered=true;
    const q=r.questions[r.current], clean=String(answer||"").trim();
    let result=await gradeWithAI(q.text,q.solution,clean);
    if(!result){
      const a=clean.toLowerCase(),s=q.solution.toLowerCase();
      let points=0;
      if(a&&s){if(a===s)points=100;else{const words=s.split(/\s+/).filter(w=>w.length>2);const hits=words.filter(w=>a.includes(w)).length;points=Math.round(Math.min(.9,hits/Math.max(words.length,1))*100);}}
      result={points,feedback:client?"Die KI konnte gerade nicht antworten. Demo-Bewertung verwendet.":"Demo-Bewertung: Für echte KI bitte OPENAI_API_KEY setzen."};
    }
    p.score+=result.points;
    socket.emit("answer:result",{points:result.points,total:p.score,feedback:result.feedback,ai:Boolean(client)});
    sendRoom(r);
  });

  socket.on("disconnect",()=>{
    for(const [c,r] of rooms){
      if(r.teacher===socket.id){io.to(c).emit("room:closed");rooms.delete(c);}
      else if(r.players.delete(socket.id))sendRoom(r);
    }
  });
});

app.get("/health",(req,res)=>res.json({ok:true,ai:Boolean(client)}));
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("KlassenBattle KI läuft auf Port "+PORT));
