import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface ThreeSwingViewProps {
  quaternion?: { x: number; y: number; z: number; w: number };
  shotSpeed?: number;
  shotTiming?: number;
  shotLiftAngle?: number;
  shotSweetSpot?: number;
  progress?: number;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #FFFFFF; overflow: hidden; touch-action: none; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #phase-hud {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.94); border: 2px solid #4CAF50; border-radius: 28px;
      padding: 5px 22px; font-family: system-ui,sans-serif; font-size: 10px; font-weight: 800;
      color: #4CAF50; letter-spacing: 2px; pointer-events: none; z-index: 100;
      text-align: center; white-space: nowrap;
    }
    #sensor-hud {
      position: fixed; top: 10px; right: 10px;
      display: flex; flex-direction: column; gap: 5px; pointer-events: none; z-index: 100;
    }
    .sc {
      background: rgba(255,255,255,0.92); border: 1.5px solid #E8E8E8; border-radius: 10px;
      padding: 4px 12px; font-family: system-ui,sans-serif; font-size: 9px; font-weight: 600;
      color: #999; text-align: right; letter-spacing: 0.8px;
    }
    .sc .sv { display: block; color: #222; font-weight: 800; font-size: 12px; margin-top: 1px; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="phase-hud">AT REST</div>
  <div id="sensor-hud">
    <div class="sc" id="chip-g">GYRO (BNO085)<span class="sv" id="sv-g">0 deg/s</span></div>
    <div class="sc" id="chip-i">IMPACT (ADXL375)<span class="sv" id="sv-i">0 g</span></div>
    <div class="sc">BAT SPEED<span class="sv" id="sv-s">-- km/h</span></div>
  </div>
  <script>
    var camera, scene, renderer, clock;
    var swingPivot, bodyGroup, batGroup;
    var impactLight, impactSphere;
    var targetQuat = new THREE.Quaternion();
    var hasInput = false;
    var swingProgress = 0;
    var autoTime = 0;
    var AUTO_PERIOD = 5.0;
    var impactFlash = 0;
    var trailMesh, trailGeo;
    var trailPoints = [];
    var MAX_TRAIL = 40;
    var orbit = { theta: 0.03, phi: 0.18, radius: 3.05 };
    var drag = { active: false, x: 0, y: 0 };
    var lookTarget = new THREE.Vector3(0, 0.78, 0.08);
    var panels = [], panelCanvases = [], panelTextures = [];
    var lUA, lFA, lThigh, lShin, lFoot, rThigh, rShin, rFoot, head;
    var sm = { speed: 0, timing: 0, liftAngle: 0, sweetSpot: 0, progress: 0 };
    var phaseHUD = document.getElementById('phase-hud');
    var chipG = document.getElementById('chip-g');
    var chipI = document.getElementById('chip-i');
    var svG = document.getElementById('sv-g');
    var svI = document.getElementById('sv-i');
    var svS = document.getElementById('sv-s');

    var PHASES = [
      { label: 'AT REST',        color: '#9E9E9E' },
      { label: 'BACKLIFT',       color: '#4CAF50' },
      { label: 'DOWNSWING',      color: '#FF9800' },
      { label: 'IMPACT!',        color: '#F44336' },
      { label: 'FOLLOW-THROUGH', color: '#4CAF50' },
    ];

    function phaseOf(p) {
      if (p < 0.08) return 0;
      if (p < 0.35) return 1;
      if (p < 0.62) return 2;
      if (p < 0.68) return 3;
      return 4;
    }

    function computeGyro(p) {
      if (p < 0.08) return 0;
      if (p < 0.35) return Math.round(((p - 0.08) / 0.27) * 180);
      if (p < 0.62) { var d = (p - 0.35) / 0.27; return Math.round(180 + d * d * 1570); }
      if (p < 0.68) return 1750;
      return Math.round(1750 * Math.pow(1 - (p - 0.68) / 0.32, 1.5));
    }

    function computeImpact(p) {
      if (p < 0.62 || p >= 0.68) return 0;
      var t = (p - 0.62) / 0.06;
      var spike = t < 0.35 ? t / 0.35 : (1 - t) / 0.65;
      var maxG = sm.sweetSpot > 0 ? Math.round(sm.sweetSpot * 1.15) : 86;
      return Math.round(Math.max(0, spike) * maxG);
    }

    function box(w,h,d,mat) { return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); }
    function cyl(rT,rB,h,mat,seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rT,rB,h,seg||12),mat); }
    function sph(r,mat,w,h) { return new THREE.Mesh(new THREE.SphereGeometry(r,w||16,h||16),mat); }

    var holoMat = new THREE.MeshPhongMaterial({
      color: 0x4CAF50, emissive: 0x002200, transparent: true, opacity: 0.22,
      depthWrite: false, shininess: 80, blending: THREE.AdditiveBlending
    });

    var mats = {
      holo: holoMat,
      grill: new THREE.MeshPhongMaterial({color:0x88ccff,shininess:80,transparent:true,opacity:0.8}),
      grip: new THREE.MeshPhongMaterial({color:0x1a1a1a,shininess:5}),
      handle: new THREE.MeshPhongMaterial({color:0x654321,shininess:18}),
      blade: new THREE.MeshPhongMaterial({color:0xDEB887,shininess:30,emissive:new THREE.Color(0xff8800),emissiveIntensity:0.2}),
      toe: new THREE.MeshPhongMaterial({color:0xC4A060,shininess:22,emissive:new THREE.Color(0xff8800),emissiveIntensity:0.2}),
      sticker: new THREE.MeshPhongMaterial({color:0x4CAF50,shininess:35}),
      grass: new THREE.MeshPhongMaterial({color:0x8fa96d,shininess:10}),
      pitch: new THREE.MeshPhongMaterial({color:0xb39975,shininess:8}),
      stump: new THREE.MeshPhongMaterial({color:0xc4a060,shininess:20}),
      crease: new THREE.MeshBasicMaterial({color:0x445566,transparent:true,opacity:0.5}),
      edge: new THREE.MeshPhongMaterial({color:0x222222,shininess:15}),
    };

    function holoPart(geom,x,y,z,sx,sy,sz,rx,ry,rz,parent) {
      var g = new THREE.Group();
      g.position.set(x,y,z); g.scale.set(sx||1,sy||1,sz||1);
      if(rx)g.rotation.x=rx; if(ry)g.rotation.y=ry; if(rz)g.rotation.z=rz;
      var m = new THREE.Mesh(geom, holoMat); m.castShadow=true; m.receiveShadow=true; g.add(m);
      var wg = new THREE.WireframeGeometry(geom);
      var wm = new THREE.LineBasicMaterial({color:0x88ccff,transparent:true,opacity:0.08,blending:THREE.AdditiveBlending});
      g.add(new THREE.LineSegments(wg,wm));
      (parent||bodyGroup).add(g); return g;
    }

    function init() {
      clock = new THREE.Clock();
      var W = window.innerWidth, H = window.innerHeight;
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xFFFFFF);
      scene.fog = new THREE.FogExp2(0xFFFFFF, 0.025);
      camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 100);
      updateCamera();
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W,H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      document.body.appendChild(renderer.domElement);
      addLights(); addGround(); addStumps(); addStadium(); addBatsman(); initTrail(); setupImpactFX();
      mkPanel("IMPACT / BAT SPEED","--","km/h",-1.35,1.62,-1.45,0.18,1.15);
      mkPanel("TIMING INDEX","--","%",-0.48,1.62,-1.58,0.06,1.00);
      mkPanel("BAT LIFT ANGLE","--","deg",0.62,1.62,-1.58,-0.06,1.00);
      mkPanel("SWEET SPOT","--","%",1.42,1.62,-1.45,-0.18,1.05);
      addControls(); animate();
    }

    function setupImpactFX() {
      impactLight = new THREE.PointLight(0xFF8800, 0, 3.5); scene.add(impactLight);
      var geo = new THREE.SphereGeometry(0.07,12,12);
      var mat = new THREE.MeshBasicMaterial({color:0xFFDD00,transparent:true,opacity:0});
      impactSphere = new THREE.Mesh(geo,mat); impactSphere.visible=false; scene.add(impactSphere);
    }

    function updateImpactFX(dt,pi) {
      impactFlash = pi===3 ? Math.min(1,impactFlash+dt*18) : Math.max(0,impactFlash-dt*5);
      if(batGroup) {
        var wp = new THREE.Vector3(0,-0.20,0); batGroup.localToWorld(wp);
        impactLight.position.copy(wp);
        if(impactSphere) impactSphere.position.copy(wp);
      }
      impactLight.intensity = impactFlash*12;
      if(impactSphere){
        impactSphere.visible = impactFlash>0.04;
        impactSphere.material.opacity = impactFlash*0.55;
        impactSphere.scale.setScalar(1+impactFlash*2.8);
      }
      mats.blade.emissiveIntensity = 0.15+impactFlash*3.2;
      mats.blade.emissive.setHex(impactFlash>0.4?0xFF5500:0xFF8800);
      mats.toe.emissiveIntensity = 0.15+impactFlash*1.8;
    }

    function updateHUD(p) {
      var pi = phaseOf(p);
      phaseHUD.textContent = PHASES[pi].label;
      phaseHUD.style.borderColor = PHASES[pi].color;
      phaseHUD.style.color = PHASES[pi].color;
      var gyro = computeGyro(p); var impact = computeImpact(p);
      var speedStr = '-- km/h';
      if(p>=0.35){
        var top = sm.speed>0?sm.speed:72;
        if(p<0.62){ var d=(p-0.35)/0.27; speedStr=Math.round(top*d*d)+' km/h'; }
        else{ var dec=p<0.68?1.0:Math.max(0.35,1-((p-0.68)/0.32)*0.65); speedStr=Math.round(top*dec)+' km/h'; }
      }
      svG.textContent=gyro+' deg/s'; svI.textContent=impact+' g'; svS.textContent=speedStr;
      if(chipI){ chipI.style.borderColor=impact>0?'#F44336':'#E8E8E8'; svI.style.color=impact>0?'#F44336':'#222'; }
      if(chipG){ chipG.style.borderColor=pi>=2?'#FF9800':'#E8E8E8'; }
    }

    function drawPanel(canvas,title,value,unit) {
      var ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='rgba(240,240,240,0.85)'; ctx.strokeStyle='rgba(76,175,80,0.95)'; ctx.lineWidth=7;
      var pad=3,r=24,w=canvas.width-pad*2,h=canvas.height-pad*2;
      ctx.beginPath(); ctx.moveTo(pad+r,pad); ctx.lineTo(pad+w-r,pad);
      ctx.quadraticCurveTo(pad+w,pad,pad+w,pad+r); ctx.lineTo(pad+w,pad+h-r);
      ctx.quadraticCurveTo(pad+w,pad+h,pad+w-r,pad+h); ctx.lineTo(pad+r,pad+h);
      ctx.quadraticCurveTo(pad,pad+h,pad,pad+h-r); ctx.lineTo(pad,pad+r);
      ctx.quadraticCurveTo(pad,pad,pad+r,pad); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='rgba(76,175,80,0.06)'; ctx.fillRect(pad+10,pad+10,w-20,h-20);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='bold 26px sans-serif'; ctx.fillStyle='#4CAF50';
      ctx.fillText(title,canvas.width/2,canvas.height*0.28);
      ctx.font='bold 72px sans-serif'; ctx.fillStyle='#333';
      ctx.shadowColor='rgba(76,175,80,0.4)'; ctx.shadowBlur=10;
      ctx.fillText(value+(unit?' '+unit:''),canvas.width/2,canvas.height*0.66);
      ctx.shadowBlur=0;
    }

    function mkPanel(title,value,unit,x,y,z,ry,scale) {
      var canvas=document.createElement('canvas'); canvas.width=512; canvas.height=256;
      drawPanel(canvas,title,value,unit);
      var tex=new THREE.CanvasTexture(canvas);
      var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.85,side:THREE.DoubleSide});
      var mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.82*(scale||1),0.40*(scale||1)),mat);
      mesh.position.set(x,y,z); mesh.rotation.y=ry; scene.add(mesh);
      panels.push({mesh,title,unit}); panelCanvases.push(canvas); panelTextures.push(tex);
    }

    function updatePanels(p) {
      if(panels.length<4)return;
      var top=sm.speed>0?sm.speed:72;
      var spd='--'; if(p>=0.35){ var s=p<0.62?Math.round(top*Math.pow((p-0.35)/0.27,2)):Math.round(top*(p<0.68?1:Math.max(0.35,1-((p-0.68)/0.32)*0.65))); spd=s+'/'+top; }
      drawPanel(panelCanvases[0],"IMPACT / BAT SPEED",spd,"km/h"); panelTextures[0].needsUpdate=true;
      drawPanel(panelCanvases[1],"TIMING INDEX",(p>0.60&&sm.timing>0)?Math.round(sm.timing):(p>0.60?'96':'--'),"%"); panelTextures[1].needsUpdate=true;
      drawPanel(panelCanvases[2],"BAT LIFT ANGLE",(p>0.08&&sm.liftAngle>0)?Math.round(sm.liftAngle):(p>0.08?'22':'--'),"deg"); panelTextures[2].needsUpdate=true;
      drawPanel(panelCanvases[3],"SWEET SPOT",(p>0.60&&sm.sweetSpot>0)?Math.round(sm.sweetSpot):(p>0.60?'82':'--'),"%"); panelTextures[3].needsUpdate=true;
    }

    function addStadium() {
      var skyGeo=new THREE.SphereGeometry(35,32,15);
      var sc=document.createElement('canvas'); sc.width=128; sc.height=256;
      var sctx=sc.getContext('2d'); var sg=sctx.createLinearGradient(0,0,0,256);
      sg.addColorStop(0,'#FFFFFF'); sg.addColorStop(0.45,'#F5F5F5'); sg.addColorStop(1.0,'#DFDFDF');
      sctx.fillStyle=sg; sctx.fillRect(0,0,128,256);
      scene.add(new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),side:THREE.BackSide,fog:false})));
      var stands=new THREE.Mesh(new THREE.CylinderGeometry(22,22,4.5,32,1,true),new THREE.MeshPhongMaterial({color:0x343333,side:THREE.BackSide,shininess:8}));
      stands.position.y=2.0; scene.add(stands);
      var bc=document.createElement('canvas'); bc.width=1024; bc.height=64;
      var bctx=bc.getContext('2d'); bctx.fillStyle='#F0F0F0'; bctx.fillRect(0,0,1024,64);
      bctx.fillStyle='#4CAF50'; bctx.font='bold 22px monospace'; bctx.textAlign='center'; bctx.textBaseline='middle';
      for(var k=0;k<6;k++) bctx.fillText('* vectorbat * SESSION ANALYSIS *',(k+0.5)*(1024/6),32);
      var btex=new THREE.CanvasTexture(bc); btex.wrapS=THREE.RepeatWrapping; btex.repeat.set(2,1);
      var led=new THREE.Mesh(new THREE.CylinderGeometry(21.9,21.9,0.4,32,1,true),new THREE.MeshBasicMaterial({map:btex,side:THREE.BackSide,transparent:true,opacity:0.7}));
      led.position.y=0.35; scene.add(led);
      addTower(-16,-14,0.7); addTower(16,-14,-0.7);
    }

    function addTower(x,z,ang) {
      var g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=ang;
      var post=cyl(0.10,0.07,6.0,new THREE.MeshPhongMaterial({color:0x14151b,shininess:10})); post.position.y=3.0; g.add(post);
      var board=box(0.8,0.5,0.15,new THREE.MeshPhongMaterial({color:0x0a0b0e})); board.position.set(0,6.0,0.1); board.rotation.x=0.22; g.add(board);
      var bm=new THREE.MeshBasicMaterial({color:0xffffff});
      for(var r=0;r<2;r++) for(var c=0;c<4;c++){var b=sph(0.04,bm,8,8);b.position.set(-0.3+c*0.2,5.85+r*0.3,0.2);g.add(b);}
      scene.add(g);
    }

    function addGrill(x,y,z,parent) {
      var gg=new THREE.Group(); gg.position.set(x,y,z);
      var fm=mats.grill;
      var wm=new THREE.LineBasicMaterial({color:0x88ccff,transparent:true,opacity:0.10,blending:THREE.AdditiveBlending});
      function addBar(geom,bx,by,bz,rx,ry,rz){
        var m=new THREE.Mesh(geom,fm); m.position.set(bx,by,bz);
        if(rx)m.rotation.x=rx; if(ry)m.rotation.y=ry; if(rz)m.rotation.z=rz; gg.add(m);
        var w=new THREE.LineSegments(new THREE.WireframeGeometry(geom),wm);
        w.position.copy(m.position); w.rotation.copy(m.rotation); gg.add(w);
      }
      addBar(new THREE.CylinderGeometry(0.003,0.003,0.08,6),-0.065,-0.04,0.02);
      addBar(new THREE.CylinderGeometry(0.003,0.003,0.08,6),0.065,-0.04,0.02);
      for(var j=0;j<3;j++) addBar(new THREE.CylinderGeometry(0.0025,0.0025,0.13,6),0,-0.015-j*0.022,0.04,0,0,Math.PI/2);
      for(var j=-1;j<=1;j++) addBar(new THREE.CylinderGeometry(0.002,0.002,0.065,6),j*0.038,-0.035,0.04);
      parent.add(gg);
    }

    function addPad(x,y,z,parent){
      var pg=new THREE.Group(); pg.position.set(x,y,z);
      holoPart(new THREE.BoxGeometry(0.11,0.38,0.04),0,0,0,1,1,1,0,0,0,pg);
      for(var r=-1;r<=1;r++) holoPart(new THREE.CylinderGeometry(0.022,0.022,0.38,8),r*0.035,0,0.022,1,1,1,0,0,0,pg);
      holoPart(new THREE.CylinderGeometry(0.030,0.030,0.12,8),0,0.14,0.030,1,1,1,0,0,Math.PI/2,pg);
      parent.add(pg);
    }

    function addGlove(x,y,z,rx,ry,rz,parent){
      var g=new THREE.Group(); g.position.set(x,y,z);
      if(rx)g.rotation.x=rx; if(ry)g.rotation.y=ry; if(rz)g.rotation.z=rz;
      holoPart(new THREE.BoxGeometry(0.06,0.07,0.045),0,0,0,1,1,1,0,0,0,g);
      for(var f=-1;f<=1;f++) holoPart(new THREE.CylinderGeometry(0.011,0.011,0.055,6),f*0.018,0.022,0.012,1,1,1,Math.PI/2,0,0,g);
      parent.add(g);
    }

    function addBatsman() {
      var root=new THREE.Group(); root.position.set(0,0,0); scene.add(root);
      bodyGroup=new THREE.Group(); bodyGroup.rotation.y=-0.03; root.add(bodyGroup);
      holoPart(new THREE.SphereGeometry(1,16,16),0,1.30,0,0.17,0.20,0.11,0,0,0);
      holoPart(new THREE.SphereGeometry(1,16,16),0,1.12,0,0.15,0.15,0.10,0,0,0);
      holoPart(new THREE.SphereGeometry(1,16,16),0,0.98,0,0.16,0.09,0.11,0,0,0);
      holoPart(new THREE.CylinderGeometry(0.05,0.05,0.07,12),0,1.46,0,1,1,1,0,0,0);
      head=holoPart(new THREE.SphereGeometry(0.09,16,16),0,1.58,0,1,1.1,1,0,0,0);
      holoPart(new THREE.SphereGeometry(0.115,16,16,0,Math.PI*2,0,Math.PI*0.6),0,1.62,0,1,1,1,0.15,0,0);
      holoPart(new THREE.BoxGeometry(0.14,0.015,0.08),0,1.55,-0.10,1,1,1,-0.25,0,0);
      addGrill(0,1.53,-0.125,bodyGroup);
      holoPart(new THREE.SphereGeometry(0.06,12,12),0.07,0.90,0.04,1,1,1,0,0,0);
      var rTG=new THREE.CylinderGeometry(0.065,0.05,0.36,12); rTG.translate(0,-0.18,0);
      rThigh=holoPart(rTG,0.07,0.90,0.04,1,1,1,0,0,0);
      holoPart(new THREE.SphereGeometry(0.048,12,12),0.07,0.54,0.04,1,1,1,0,0,0);
      var rSG=new THREE.CylinderGeometry(0.05,0.038,0.36,12); rSG.translate(0,-0.18,0);
      rShin=holoPart(rSG,0.07,0.54,0.04,1,1,1,0,0,0);
      addPad(0,-0.18,0.04,rShin);
      holoPart(new THREE.SphereGeometry(0.038,12,12),0.07,0.18,0.04,1,1,1,0,0,0);
      var rFG=new THREE.BoxGeometry(0.08,0.05,0.15); rFG.translate(0,0,0.05);
      rFoot=holoPart(rFG,0.07,0.028,-0.04,1,1,1,0,0,0);
      holoPart(new THREE.SphereGeometry(0.06,12,12),-0.07,0.90,-0.14,1,1,1,0,0,0);
      var lTG=new THREE.CylinderGeometry(0.065,0.05,0.36,12); lTG.translate(0,-0.18,0);
      lThigh=holoPart(lTG,-0.07,0.90,-0.14,1,1,1,0,0,0);
      holoPart(new THREE.SphereGeometry(0.048,12,12),-0.07,0.54,-0.14,1,1,1,0,0,0);
      var lSG=new THREE.CylinderGeometry(0.05,0.038,0.36,12); lSG.translate(0,-0.18,0);
      lShin=holoPart(lSG,-0.07,0.54,-0.14,1,1,1,0,0,0);
      addPad(0,-0.18,-0.06,lShin);
      holoPart(new THREE.SphereGeometry(0.038,12,12),-0.07,0.18,-0.14,1,1,1,0,0,0);
      var lFG=new THREE.BoxGeometry(0.08,0.05,0.15); lFG.translate(0,0,0.05);
      lFoot=holoPart(lFG,-0.07,0.028,-0.23,1,1,1,0,0,0);
      holoPart(new THREE.SphereGeometry(0.046,12,12),-0.18,1.34,-0.02,1,1,1,0,0,0);
      var lUAG=new THREE.CylinderGeometry(0.038,0.032,0.26,12); lUAG.translate(0,-0.13,0);
      lUA=holoPart(lUAG,-0.18,1.34,-0.02,1,1,1,0.5,0,0.5);
      var lFAG=new THREE.CylinderGeometry(0.032,0.026,0.24,12); lFAG.translate(0,-0.12,0);
      lFA=holoPart(lFAG,-0.25,1.20,-0.08,1,1,1,1.0,0,0.4);
      swingPivot=new THREE.Group(); swingPivot.position.set(0.15,1.38,0); bodyGroup.add(swingPivot);
      holoPart(new THREE.SphereGeometry(0.046,12,12),0,0,0,1,1,1,0,0,0,swingPivot);
      var rUAG=new THREE.CylinderGeometry(0.04,0.034,0.27,12); rUAG.translate(0,-0.135,0);
      holoPart(rUAG,0.0,0.0,0.0,1,1,1,0.6,0,-0.2,swingPivot);
      var rFAG=new THREE.CylinderGeometry(0.034,0.028,0.24,12); rFAG.translate(0,-0.12,0);
      holoPart(rFAG,0.03,-0.20,0.10,1,1,1,1.1,0,-0.15,swingPivot);
      addGlove(0.04,-0.40,0.28,0,0,0,swingPivot); addGlove(-0.02,-0.42,0.30,0,0,0,swingPivot);
      batGroup=new THREE.Group(); batGroup.position.set(0.01,-0.44,0.32); swingPivot.add(batGroup);
      var grip=cyl(0.024,0.021,0.11,mats.grip,10); grip.position.y=0.34; grip.castShadow=true; batGroup.add(grip);
      var handle=cyl(0.017,0.019,0.20,mats.handle,10); handle.position.y=0.19; handle.castShadow=true; batGroup.add(handle);
      var splice=box(0.06,0.06,0.035,mats.handle); splice.position.y=0.06; splice.castShadow=true; batGroup.add(splice);
      var blade=box(0.108,0.46,0.038,mats.blade); blade.position.y=-0.20; blade.castShadow=true; batGroup.add(blade);
      var toe=box(0.108,0.03,0.038,mats.toe); toe.position.y=-0.45; toe.castShadow=true; batGroup.add(toe);
      var sticker=box(0.07,0.13,0.002,mats.sticker); sticker.position.set(0,-0.10,-0.021); batGroup.add(sticker);
      var lEdge=box(0.004,0.46,0.038,mats.edge); lEdge.position.set(-0.056,-0.20,0); batGroup.add(lEdge);
      var rEdge=box(0.004,0.46,0.038,mats.edge); rEdge.position.set(0.056,-0.20,0); batGroup.add(rEdge);
      swingPivot.rotation.set(-1.25,0.08,0.05);
    }

    function initTrail() {
      trailGeo=new THREE.BufferGeometry();
      var v=new Float32Array(MAX_TRAIL*2*3); var c=new Float32Array(MAX_TRAIL*2*3);
      trailGeo.setAttribute('position',new THREE.BufferAttribute(v,3));
      trailGeo.setAttribute('color',new THREE.BufferAttribute(c,3));
      var idx=[];
      for(var i=0;i<MAX_TRAIL-1;i++){var vi=i*2;idx.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2);}
      trailGeo.setIndex(idx);
      trailMesh=new THREE.Mesh(trailGeo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false}));
      trailMesh.frustumCulled=false; scene.add(trailMesh);
    }

    var TRAIL_COLS=[
      new THREE.Color(0x9E9E9E), new THREE.Color(0x4CAF50),
      new THREE.Color(0xFF9800), new THREE.Color(0xFFFFFF), new THREE.Color(0x4CAF50)
    ];

    function updateTrail(p) {
      if(!batGroup)return;
      var tip=new THREE.Vector3(0,-0.45,0); var top=new THREE.Vector3(0,0.15,0);
      batGroup.localToWorld(tip); batGroup.localToWorld(top);
      trailPoints.push({top:top,bot:tip});
      if(trailPoints.length>MAX_TRAIL)trailPoints.shift();
      var pi=phaseOf(p); var tc=TRAIL_COLS[pi];
      var pos=trailGeo.attributes.position.array; var col=trailGeo.attributes.color.array;
      for(var i=0;i<MAX_TRAIL;i++){
        var ptIdx=trailPoints.length-1-i; var pT,pB,alpha;
        if(ptIdx>=0&&ptIdx<trailPoints.length){pT=trailPoints[ptIdx].top;pB=trailPoints[ptIdx].bot;alpha=1-(i/MAX_TRAIL);alpha=alpha*alpha;}
        else{pT=trailPoints[0]?trailPoints[0].top:top;pB=trailPoints[0]?trailPoints[0].bot:tip;alpha=0;}
        var vi=i*6;
        pos[vi]=pT.x;pos[vi+1]=pT.y;pos[vi+2]=pT.z;pos[vi+3]=pB.x;pos[vi+4]=pB.y;pos[vi+5]=pB.z;
        var boost=pi===3?1+impactFlash*2.5:1;
        var r=Math.min(1,tc.r*boost*alpha);var g=Math.min(1,tc.g*boost*alpha);var b=Math.min(1,tc.b*boost*alpha);
        col[vi]=r;col[vi+1]=g;col[vi+2]=b;col[vi+3]=r;col[vi+4]=g;col[vi+5]=b;
      }
      trailGeo.attributes.position.needsUpdate=true; trailGeo.attributes.color.needsUpdate=true;
    }

    function addLights() {
      scene.add(new THREE.HemisphereLight(0x87CEEB,0x362a1a,0.35));
      scene.add(new THREE.AmbientLight(0x404050,0.25));
      var sun=new THREE.DirectionalLight(0xfff4e0,1.3); sun.position.set(5,8,3); sun.castShadow=true;
      sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.near=0.5; sun.shadow.camera.far=25;
      sun.shadow.camera.left=-5; sun.shadow.camera.right=5; sun.shadow.camera.top=5; sun.shadow.camera.bottom=-5;
      sun.shadow.bias=-0.0008; scene.add(sun);
      var fill=new THREE.DirectionalLight(0xb0c4de,0.25); fill.position.set(-4,5,-3); scene.add(fill);
      var rim=new THREE.PointLight(0xff9944,0.5,12); rim.position.set(-2,2,3); scene.add(rim);
    }

    function addGround() {
      var ground=new THREE.Mesh(new THREE.PlaneGeometry(50,50),mats.grass);
      ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
      for(var i=-8;i<=8;i++){
        var stripe=new THREE.Mesh(new THREE.PlaneGeometry(50,1.4),new THREE.MeshBasicMaterial({color:i%2===0?0xffffff:0x000000,transparent:true,opacity:0.04}));
        stripe.rotation.x=-Math.PI/2; stripe.position.set(0,0.004,i*1.4); scene.add(stripe);
      }
      var pitch=new THREE.Mesh(new THREE.PlaneGeometry(2.6,20),mats.pitch);
      pitch.rotation.x=-Math.PI/2; pitch.position.y=0.003; scene.add(pitch);
      function cl(x,z,w,d){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mats.crease);m.rotation.x=-Math.PI/2;m.position.set(x,0.006,z);scene.add(m);}
      cl(0,0.3,2.2,0.025); cl(0,-0.15,0.8,0.02); cl(-1.1,0.08,0.02,0.48); cl(1.1,0.08,0.02,0.48);
    }

    function addStumps() {
      for(var i=-1;i<=1;i++){var s=cyl(0.014,0.014,0.71,mats.stump,8);s.position.set(i*0.115,0.355,0.55);s.castShadow=true;scene.add(s);}
      for(var i=0;i<2;i++){var b=cyl(0.007,0.007,0.11,mats.stump,6);b.rotation.z=Math.PI/2;b.position.set((i-0.5)*0.115,0.72,0.55);scene.add(b);}
    }

    function updateCamera() {
      camera.position.set(
        lookTarget.x+orbit.radius*Math.sin(orbit.theta)*Math.cos(orbit.phi),
        lookTarget.y+orbit.radius*Math.sin(orbit.phi),
        lookTarget.z+orbit.radius*Math.cos(orbit.theta)*Math.cos(orbit.phi)
      );
      camera.lookAt(lookTarget);
    }

    function addControls() {
      var el=renderer.domElement;
      function onDown(cx,cy){drag.active=true;drag.x=cx;drag.y=cy;}
      function onMove(cx,cy){if(!drag.active)return;orbit.theta-=(cx-drag.x)*0.008;orbit.phi=Math.max(0.05,Math.min(1.45,orbit.phi+(cy-drag.y)*0.008));drag.x=cx;drag.y=cy;updateCamera();}
      function onUp(){drag.active=false;}
      el.addEventListener('mousedown',function(e){onDown(e.clientX,e.clientY);});
      el.addEventListener('mousemove',function(e){onMove(e.clientX,e.clientY);});
      el.addEventListener('mouseup',onUp); el.addEventListener('mouseleave',onUp);
      el.addEventListener('wheel',function(e){orbit.radius=Math.max(2.4,Math.min(5.5,orbit.radius+e.deltaY*0.005));updateCamera();});
      el.addEventListener('touchstart',function(e){if(e.touches.length===1)onDown(e.touches[0].clientX,e.touches[0].clientY);});
      el.addEventListener('touchmove',function(e){if(e.touches.length===1)onMove(e.touches[0].clientX,e.touches[0].clientY);});
      el.addEventListener('touchend',onUp);
      window.addEventListener('resize',function(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
    }

    // Procedural 5-phase auto-swing (runs when no BLE quaternion received)
    function runAutoSwing(dt) {
      autoTime=(autoTime+dt)%AUTO_PERIOD;
      var t=autoTime/AUTO_PERIOD;
      swingProgress=t;
      var rx,ry,rz;
      if(t<0.08){
        rx=-1.25; ry=0.08; rz=0.05;
      } else if(t<0.35){
        var b=(t-0.08)/0.27; var eb=b*b*(3-2*b);
        rx=-1.25+eb*(-2.05); ry=0.08+eb*0.30; rz=0.05+eb*0.45;
      } else if(t<0.62){
        var d=(t-0.35)/0.27; var ed=d*d;
        rx=-3.30+ed*4.10; ry=0.38-ed*0.50; rz=0.50-ed*1.25;
      } else if(t<0.68){
        rx=0.80; ry=-0.12; rz=-0.75;
      } else {
        var f=(t-0.68)/0.32; var ef=f*(2-f);
        rx=0.80+ef*1.55; ry=-0.12+ef*0.62; rz=-0.75-ef*0.82;
      }
      swingPivot.rotation.set(rx,ry,rz);
    }

    function animateBody(p) {
      if(!swingPivot||!bodyGroup)return;
      bodyGroup.rotation.y=-0.03+p*0.18; bodyGroup.rotation.x=p*0.15; bodyGroup.rotation.z=-p*0.08;
      if(head){head.rotation.y=-bodyGroup.rotation.y;head.rotation.x=0.1-p*0.15;}
      if(lUA&&lFA){lUA.rotation.x=0.5-p*1.3;lUA.rotation.z=0.5-p*0.9;lFA.rotation.x=1.0-p*0.8;lFA.rotation.z=0.4-p*0.6;}
      if(lThigh&&lShin&&rThigh&&rShin){
        lThigh.rotation.x=p*0.25; lShin.rotation.x=-p*0.35; if(lFoot)lFoot.rotation.x=p*0.1;
        rThigh.rotation.x=-p*0.15; rShin.rotation.x=p*0.25; if(rFoot)rFoot.rotation.x=-p*0.35;
      }
    }

    function animate() {
      requestAnimationFrame(animate);
      var dt=clock.getDelta();
      if(hasInput){
        swingPivot.quaternion.copy(targetQuat);
        swingProgress=sm.progress||0;
      } else {
        orbit.theta+=dt*0.20; updateCamera(); runAutoSwing(dt);
      }
      var pi=phaseOf(swingProgress);
      animateBody(swingProgress);
      updateImpactFX(dt,pi);
      updateHUD(swingProgress);
      updatePanels(swingProgress);
      updateTrail(swingProgress);
      renderer.render(scene,camera);
    }

    function handleMessage(s) {
      try {
        var d=JSON.parse(s);
        if(d.type==='quaternion'&&swingPivot){hasInput=true;targetQuat.set(d.q.x,d.q.y,d.q.z,d.q.w);}
        if(d.type==='metrics'){sm=Object.assign(sm,d.metrics);if(d.metrics.progress!==undefined)swingProgress=d.metrics.progress;}
      }catch(e){}
    }
    document.addEventListener('message',function(e){handleMessage(e.data);});
    window.addEventListener('message',function(e){handleMessage(e.data);});
    init();
  </script>
</body>
</html>`;

export function ThreeSwingView({
  quaternion,
  shotSpeed,
  shotTiming,
  shotLiftAngle,
  shotSweetSpot,
  progress,
}: ThreeSwingViewProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const sendQuaternion = useCallback((q: { x: number; y: number; z: number; w: number }) => {
    const msg = JSON.stringify({ type: 'quaternion', q });
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof handleMessage === 'function') {
          handleMessage('${msg}');
        }
        true;
      `);
    }
  }, []);

  const sendMetrics = useCallback((metrics: { speed: number; timing: number; liftAngle: number; sweetSpot: number; progress: number }) => {
    const msg = JSON.stringify({ type: 'metrics', metrics });
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof handleMessage === 'function') {
          handleMessage('${msg}');
        }
        true;
      `);
    }
  }, []);

  useEffect(() => {
    if (quaternion) {
      sendQuaternion(quaternion);
    }
  }, [quaternion, sendQuaternion]);

  useEffect(() => {
    sendMetrics({
      speed: shotSpeed ?? 0,
      timing: shotTiming ?? 0,
      liftAngle: shotLiftAngle ?? 0,
      sweetSpot: shotSweetSpot ?? 0,
      progress: progress ?? 0,
    });
  }, [shotSpeed, shotTiming, shotLiftAngle, shotSweetSpot, progress, sendMetrics]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={HTML_CONTENT}
          style={{ width: '100%', height: '100%', border: 'none' }}
          ref={(el) => {
            iframeRef.current = el;
            if (el) {
              setTimeout(() => {
                if (quaternion) sendQuaternion(quaternion);
                sendMetrics({
                  speed: shotSpeed ?? 0,
                  timing: shotTiming ?? 0,
                  liftAngle: shotLiftAngle ?? 0,
                  sweetSpot: shotSweetSpot ?? 0,
                  progress: progress ?? 0,
                });
              }, 300);
            }
          }}
        />
      ) : (
        <WebView
          ref={webViewRef as any}
          originWhitelist={['*']}
          source={{ html: HTML_CONTENT }}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled={true}
          onLoadEnd={() => {
            if (quaternion) sendQuaternion(quaternion);
            sendMetrics({
              speed: shotSpeed ?? 0,
              timing: shotTiming ?? 0,
              liftAngle: shotLiftAngle ?? 0,
              sweetSpot: shotSweetSpot ?? 0,
              progress: progress ?? 0,
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
