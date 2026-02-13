배포 URL: https://lpioneer.github.io/MilkyWaySolarisSim

# MilkyWaySolarisSim

블랙홀 시각화(기존 Singularity 기반)에 우리은하/태양계 시뮬레이션을 결합한 WebGPU 프로젝트입니다.  
은하 중심, 나선팔, 성운/먼지, 태양계 공전 궤적을 한 장면에서 확인할 수 있습니다.

## 주요 기능

- 블랙홀 중심부 시각화 (노드 기반 셰이더)
- 은하 파티클 + 성운 + 벌지 + 먼지 레이어
- 태양계 이동 및 궤적 표시
- 뷰 전환
  - Galactic View
  - Solar System View
- UI 토글
  - 은하 관련 레이어 전체 표시/숨김

## 기술 스택

- `three` (WebGPU/TSL)
- `vite`
- `tweakpane`

## 실행 방법

### 1) 요구사항

- Node.js 18+ 권장
- npm 사용 가능 환경

### 2) 설치

```bash
npm install
```

### 3) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소로 접속합니다.

## 빌드

```bash
npm run build
```

## 조작 방법

- 마우스 드래그: 카메라 회전
- 휠: 줌 인/아웃
- 우측 상단 버튼
  - `Switch to Solar System View`: 은하/태양계 시점 전환
  - `Hide Galaxy Particles`: 은하 레이어(파티클/성운/벌지/먼지) 표시 토글

## 프로젝트 구조(핵심)

- `src/Experience/Worlds/MainWorld/BlackHole.js`
  - 블랙홀 시각 효과
- `src/Experience/Worlds/MainWorld/Galaxy.js`
  - 은하 파티클/성운/벌지/먼지 생성 및 업데이트
- `src/Experience/Worlds/MainWorld/SolarSystem.js`
  - 태양 및 행성 시스템 업데이트
- `src/Experience/Worlds/MainWorld/MainWorld.js`
  - 전체 월드 구성, UI 버튼 이벤트, 뷰 전환

## 문제 해결

### npm 설치 시 `EACCES` 권한 오류

`.npm` 캐시에 권한 문제가 있으면 아래 명령으로 소유권을 복구합니다.

```bash
sudo chown -R "$(id -u)":"$(id -g)" ~/.npm
```

그 후 다시 `npm install`을 실행합니다.

## 참고

- 본 프로젝트는 `singularity` 기반 프로젝트를 확장한 버전입니다.
- 블랙홀 시뮬레이션 원본 출처: [MisterPrada/singularity](https://github.com/MisterPrada/singularity?ref=webgpu.com)
