// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library XPLib {
    function getXPTable() internal pure returns (uint32[99] memory) {
        uint32[99] memory xpTable;
        xpTable[0]=0;xpTable[1]=83;xpTable[2]=174;xpTable[3]=276;xpTable[4]=388;xpTable[5]=512;xpTable[6]=650;xpTable[7]=801;xpTable[8]=969;xpTable[9]=1154;
        xpTable[10]=1358;xpTable[11]=1584;xpTable[12]=1833;xpTable[13]=2107;xpTable[14]=2411;xpTable[15]=2746;xpTable[16]=3115;xpTable[17]=3523;xpTable[18]=3973;xpTable[19]=4470;
        xpTable[20]=5018;xpTable[21]=5624;xpTable[22]=6291;xpTable[23]=7028;xpTable[24]=7842;xpTable[25]=8740;xpTable[26]=9730;xpTable[27]=10824;xpTable[28]=12031;xpTable[29]=13363;
        xpTable[30]=14833;xpTable[31]=16456;xpTable[32]=18247;xpTable[33]=20224;xpTable[34]=22406;xpTable[35]=24815;xpTable[36]=27473;xpTable[37]=30408;xpTable[38]=33648;xpTable[39]=37224;
        xpTable[40]=41171;xpTable[41]=45529;xpTable[42]=50339;xpTable[43]=55649;xpTable[44]=61512;xpTable[45]=67983;xpTable[46]=75127;xpTable[47]=83014;xpTable[48]=91721;xpTable[49]=101333;
        xpTable[50]=111945;xpTable[51]=123660;xpTable[52]=136594;xpTable[53]=150872;xpTable[54]=166636;xpTable[55]=184040;xpTable[56]=203254;xpTable[57]=224466;xpTable[58]=247886;xpTable[59]=273742;
        xpTable[60]=302288;xpTable[61]=333804;xpTable[62]=368599;xpTable[63]=407015;xpTable[64]=449428;xpTable[65]=496254;xpTable[66]=547953;xpTable[67]=605032;xpTable[68]=668051;xpTable[69]=737627;
        xpTable[70]=814445;xpTable[71]=899257;xpTable[72]=992895;xpTable[73]=1096278;xpTable[74]=1210421;xpTable[75]=1336443;xpTable[76]=1475581;xpTable[77]=1629200;xpTable[78]=1798808;xpTable[79]=1986068;
        xpTable[80]=2192818;xpTable[81]=2421087;xpTable[82]=2673114;xpTable[83]=2951373;xpTable[84]=3258594;xpTable[85]=3597792;xpTable[86]=3972294;xpTable[87]=4385776;xpTable[88]=4842295;xpTable[89]=5346332;
        xpTable[90]=5902831;xpTable[91]=6517253;xpTable[92]=7195629;xpTable[93]=7944614;xpTable[94]=8771558;xpTable[95]=9684577;xpTable[96]=10692629;xpTable[97]=11805606;xpTable[98]=13034431;
        return xpTable;
    }
    
    function getLevelFromXP(uint32 xp) internal pure returns (uint8) {
        uint32[99] memory xpTable = getXPTable();
        if (xp < xpTable[1]) return 1;
        if (xp >= xpTable[98]) return 99;
        for (uint8 i = 98; i >= 1; i--) {
            if (xp >= xpTable[i]) return i + 1;
        }
        return 1;
    }
    
    function getXPForLevel(uint8 level) internal pure returns (uint32) {
        require(level >= 1 && level <= 99, "Invalid level");
        return getXPTable()[level - 1];
    }
    
    function addXP(uint32 currentXp, uint32 xpGain) internal pure returns (uint32 newXp, uint8 newLevel, bool leveledUp) {
        newXp = currentXp + xpGain;
        if (newXp > 13034431) newXp = 13034431;
        uint8 oldLevel = getLevelFromXP(currentXp);
        newLevel = getLevelFromXP(newXp);
        leveledUp = newLevel > oldLevel;
        return (newXp, newLevel, leveledUp);
    }
    
    function getWoodcuttingXP(uint8 logType) internal pure returns (uint32) {
        if (logType == 0) return 25;
        return 25;
    }
    
    function getFishingXP(uint8 fishType) internal pure returns (uint32) {
        if (fishType == 0) return 20;
        return 20;
    }
    
    function getCookingXP(uint8 foodType) internal pure returns (uint32) {
        if (foodType == 0) return 30;
        return 30;
    }
    
    function getFiremakingXP(uint8 logType) internal pure returns (uint32) {
        if (logType == 0) return 40;
        return 40;
    }
}

