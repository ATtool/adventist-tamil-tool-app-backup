import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ScrollView, 
  ActivityIndicator, Image, Modal, Share, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../context/SettingsContext';
import BiblePickers from '../components/bible/BiblePickers';
import InAppBrowser from '../components/InAppBrowser';
import booksData from '../data/books.json';
import { getSafeDb, getTableNameSync, querySync } from '../utils/DatabaseManager';

const { width, height } = Dimensions.get('window');

// --- FILE PATHS & LINKS ---
const DB_FILENAME = 'study_optimized.db';
const DB_PATH = FileSystem.documentDirectory + 'SQLite/' + DB_FILENAME;
const MAPS_FOLDER = FileSystem.documentDirectory + 'BibleMaps/';
const DB_DIRECT_URL = 'https://www.dropbox.com/scl/fi/j5y9fu6d3hltt1cr8fu6g/study_optimized.db?rlkey=2or1yrh467qo0az6h0k73jvvo&st=gcedrhmp&dl=1';

const BT_BOOKS = [
  "Gen","Exo","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam","1Kgs","2Kgs","1Chron","2Chron","Ezra","Neh","Esth","Job","Ps","Prov","Eccles","Song","Isa","Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph","Hag","Zech","Mal",
  "Matt","Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph","Phil","Col","1Thess","2Thess","1Tim","2Tim","Titus","Philem","Heb","Jas","1Pet","2Pet","1John","2John","3John","Jude","Rev"
];

const MAP_FILES = [
  { name: '8.jpg', url: 'https://www.dropbox.com/scl/fi/p8cksjv2oyn9ejlcq4be8/8.jpg?rlkey=ojgv9sc4yhldclpp0wljv8n4e&st=ace2az99&dl=1' },
  { name: '21.jpg', url: 'https://www.dropbox.com/scl/fi/a7amq4uw9pwrjanqte0v9/21.jpg?rlkey=swt3npx0q4vcq8cgfohaympy4&st=4ip8q2ee&dl=1' },
  { name: '22.jpg', url: 'https://www.dropbox.com/scl/fi/6cqfl4yldt0xqngdqrz5u/22.jpg?rlkey=531wxv80si3qk9w968037r2n4&st=bg2d9s6z&dl=1' },
  { name: '27.jpg', url: 'https://www.dropbox.com/scl/fi/kkndsg08rhqimtrsr6rs3/27.jpg?rlkey=xy6ijwx1c1ktrooi08adqqb6q&st=cjnjhaow&dl=1' },
  { name: '28.jpg', url: 'https://www.dropbox.com/scl/fi/a0w6xohvjjjzi1xuhn08j/28.jpg?rlkey=gafj0mdo1o27skxxp34jiegkt&st=bv5l1zgy&dl=1' },
  { name: '29.jpg', url: 'https://www.dropbox.com/scl/fi/o0yqc7qg3sud9pf6tekdo/29.jpg?rlkey=fs95833329rld8qun94ni0i5u&st=49p26h7o&dl=1' },
  { name: '30.jpg', url: 'https://www.dropbox.com/scl/fi/fzyj4yzfwo80s384swxmw/30.jpg?rlkey=ppf6o2enycqc5svfr924qvybb&st=l2psjhvi&dl=1' },
  { name: '31.jpg', url: 'https://www.dropbox.com/scl/fi/x6savszrzfgx3d0q38ubh/31.jpg?rlkey=rjgdatfchiq5em3hmcr1pxeom&st=7c5k4b2t&dl=1' },
  { name: '39.jpg', url: 'https://www.dropbox.com/scl/fi/uofjy2s7fnr1zocnlhhdp/39.jpg?rlkey=rdwgyiu82r4wtdgj8ozhx5g0c&st=bpi8310b&dl=1' },
  { name: '40.jpg', url: 'https://www.dropbox.com/scl/fi/nvmi2xpyr5hezj8j0xxsh/40.jpg?rlkey=xgqhiyqluuxz0uom4n1x9e8ef&st=1vaj1aei&dl=1' },
  { name: '41.jpg', url: 'https://www.dropbox.com/scl/fi/jlwriq0rofhm774rzu69m/41.jpg?rlkey=bgbcfrkswi8hjm8c6kkrjqleq&st=7nohy9bz&dl=1' },
  { name: '42.jpg', url: 'https://www.dropbox.com/scl/fi/cgqb6x6iir16n6uumo289/42.jpg?rlkey=ni79dwfq1lm7jr1tj4bdfjgb5&st=hubvt58w&dl=1' },
  { name: '44.jpg', url: 'https://www.dropbox.com/scl/fi/rsjysz77c2u1dtq1yf6rk/44.jpg?rlkey=5adtsbh43ao3leeg4ve4egy3c&st=h1qztksx&dl=1' },
  { name: '46.jpg', url: 'https://www.dropbox.com/scl/fi/go202v5ni26jc9aq8iutx/46.jpg?rlkey=yg8ktp6841qre0zvplgr3wwvt&st=j4synjop&dl=1' },
  { name: '47.jpg', url: 'https://www.dropbox.com/scl/fi/jyi5p9rs11gda5wociugt/47.jpg?rlkey=2inkj0hq8qa3465aq3egp516k&st=s4qosajx&dl=1' },
  { name: '49.jpg', url: 'https://www.dropbox.com/scl/fi/m5g5v3p690scrgvbfz9qx/49.jpg?rlkey=qavo1ylsvev2etulmm0nvwgvr&st=yv8f3s1j&dl=1' },
  { name: '50.jpg', url: 'https://www.dropbox.com/scl/fi/meeyqrs27hdrb93jtiro6/50.jpg?rlkey=6vw8md1rdrlntnkr3mn8y4gh7&st=co9o0wa0&dl=1' },
  { name: '52.jpg', url: 'https://www.dropbox.com/scl/fi/5xx3xie2s5dyio9xr3dex/52.jpg?rlkey=jn4cikc0ooyss231z66hxcwp7&st=fz08b57v&dl=1' },
  { name: '53.jpg', url: 'https://www.dropbox.com/scl/fi/iro05ih8pu33r2xdinwux/53.jpg?rlkey=pr087599s31142hg7x6qz4i8u&st=1ubp4fez&dl=1' },
  { name: '54.jpg', url: 'https://www.dropbox.com/scl/fi/c5rlt8ph860bm8hl4ckue/54.jpg?rlkey=rtm2ifmaqjnfg1pasunmajnno&st=923vs3pt&dl=1' },
  { name: '55.jpg', url: 'https://www.dropbox.com/scl/fi/5f9ayx9a3eqyf874kvl69/55.jpg?rlkey=hmpyxppcorw6mrq2bdg1g55at&st=ffiwds34&dl=1' },
  { name: '56.jpg', url: 'https://www.dropbox.com/scl/fi/f13wwpd8cvl98kkgwd4km/56.jpg?rlkey=t39ubwawu0hq9va64afg39g5n&st=222yaxkb&dl=1' },
  { name: '57.jpg', url: 'https://www.dropbox.com/scl/fi/3qrxkog9gwfh00kz38xqc/57.jpg?rlkey=1whgouis6kjfoo30n5xodsd9h&st=9oio4p70&dl=1' },
  { name: '58.jpg', url: 'https://www.dropbox.com/scl/fi/17a4nawdridy08qr5ap1q/58.jpg?rlkey=rib6xodyxmvpj3j9k3hbjxnjv&st=iuafay3h&dl=1' },
  { name: '59.jpg', url: 'https://www.dropbox.com/scl/fi/jdluof8pfg0h04bl3aiq8/59.jpg?rlkey=lfsb11joc2g5ukx7bqjkcwf2o&st=bcy0gqiw&dl=1' },
  { name: '60.jpg', url: 'https://www.dropbox.com/scl/fi/7rwml9nwwdp2lg2c3n8mw/60.jpg?rlkey=4l2wg8lfggqr69tjfh3cbvcx9&st=ppqgnnu6&dl=1' },
  { name: '61.jpg', url: 'https://www.dropbox.com/scl/fi/yyjrok82gmwkd4hmbekhi/61.jpg?rlkey=t7oz3x8jtt54boewrvs5gdcw7&st=lxtoimlv&dl=1' },
  { name: '62.jpg', url: 'https://www.dropbox.com/scl/fi/smldy7o6cqdzs7xk2zluv/62.jpg?rlkey=31f0ezthvhakaps1erfhlzc0o&st=fdl5e1j4&dl=1' },
  { name: '63.jpg', url: 'https://www.dropbox.com/scl/fi/2gfyn9fmoggy9fbrmzi6a/63.jpg?rlkey=ddq5am87eh094b91yrdvf7xrn&st=o10iyg65&dl=1' },
  { name: '64.jpg', url: 'https://www.dropbox.com/scl/fi/ssp9tds3xutzfuisjvohw/64.jpg?rlkey=1gvlf5v7smkj4q0ra4v6hncag&st=lxwcsyf4&dl=1' },
  { name: '65.jpg', url: 'https://www.dropbox.com/scl/fi/koog4tbus43t9qsolfqcz/65.jpg?rlkey=1rf3kq1se6qn64ptix873nml2&st=nj1mjtbb&dl=1' },
  { name: '66.jpg', url: 'https://www.dropbox.com/scl/fi/6j5mukinldtgv5570n5zm/66.jpg?rlkey=38b0yxhmc6ds8ep9bzoo3o71y&st=5luxtf6o&dl=1' },
  { name: '67.jpg', url: 'https://www.dropbox.com/scl/fi/9ah1qboczptv9yeauxcmg/67.jpg?rlkey=wfndndv3n9yrg37ay1n9uiuyu&st=69ybfu07&dl=1' },
  { name: '68.jpg', url: 'https://www.dropbox.com/scl/fi/mvysn33uxjb15d30dddi0/68.jpg?rlkey=7123f7lfhy14nhkf4qw50ixih&st=67uji7ud&dl=1' },
  { name: '69.jpg', url: 'https://www.dropbox.com/scl/fi/qpc56zfuodkafdlupz2u5/69.jpg?rlkey=9f7kk5urpj3txezszwzzvhdwc&st=sa3d4zty&dl=1' },
  { name: '70.jpg', url: 'https://www.dropbox.com/scl/fi/6szwfs605q9oqspmmk0ng/70.jpg?rlkey=lmpcywnqt8onwkysu1uls7hkv&st=8w1ayfqz&dl=1' },
  { name: '72.jpg', url: 'https://www.dropbox.com/scl/fi/l4n9uhrqbpzjt2mrlo84i/72.jpg?rlkey=8wvgxk93eshv2i3w8s1jjl0ty&st=zdd2ashf&dl=1' },
  { name: '73.jpg', url: 'https://www.dropbox.com/scl/fi/3xl5tqrbv95tiuurzyrpa/73.jpg?rlkey=alrecal711tqikb8sf0cow6oe&st=iyhpek05&dl=1' },
  { name: '74.jpg', url: 'https://www.dropbox.com/scl/fi/bnexb3w1yqq13kefcu3pw/74.jpg?rlkey=ujoss0ptj0c6omvz8mneefar6&st=k2lozgut&dl=1' },
  { name: '75.jpg', url: 'https://www.dropbox.com/scl/fi/ww0kuba63hfycy9lqf0t8/75.jpg?rlkey=9uuixvkl7ls4bvja5olkjjm10&st=mfe99mg1&dl=1' },
  { name: '76.jpg', url: 'https://www.dropbox.com/scl/fi/6til7g4gxzx502fhp6edy/76.jpg?rlkey=2s2vj55xz6n3n31r1eqbvrt2g&st=7vdybcyx&dl=1' },
  { name: '77.jpg', url: 'https://www.dropbox.com/scl/fi/bek2vdxjrzzpmhz2ude80/77.jpg?rlkey=hm0akyqwmqwsxjzfpytlrmvb9&st=uiixvgod&dl=1' },
  { name: '78.jpg', url: 'https://www.dropbox.com/scl/fi/3jmq82ji1evh1nq4yiaoc/78.jpg?rlkey=oug6q2mn95uyd96o6g47tozqa&st=jbganur3&dl=1' },
  { name: '80.jpg', url: 'https://www.dropbox.com/scl/fi/eidvdem7jfjabnx7g2c2o/80.jpg?rlkey=rlovfupwnhzerfgl5l64deye0&st=eakp5ird&dl=1' },
  { name: '81.jpg', url: 'https://www.dropbox.com/scl/fi/bi1ij6b9dvdb81103mx4y/81.jpg?rlkey=wwfwdpq98xgmpirvch0vyexlg&st=94rhupct&dl=1' },
  { name: '82.jpg', url: 'https://www.dropbox.com/scl/fi/xfzytg7mo7a1yjv1eq4ax/82.jpg?rlkey=jh1ai5q6sc8xo9yl3iw5wy5bn&st=15051h57&dl=1' },
  { name: '83.jpg', url: 'https://www.dropbox.com/scl/fi/qkz0fne3jn2t0kv93k074/83.jpg?rlkey=hy6nfrqibj0czym7zdryaz8tv&st=udsm1t1x&dl=1' },
  { name: '84.jpg', url: 'https://www.dropbox.com/scl/fi/bhl6dj14wbpwkbtd9jfck/84.jpg?rlkey=z61qqp8m2jumxqnrgqcf64jcp&st=35ycneg5&dl=1' },
  { name: '87.jpg', url: 'https://www.dropbox.com/scl/fi/0u4g4h4kykvp0y0h43ev9/87.jpg?rlkey=owp15o11d2r4wpbng3vpgarbx&st=yibf0muc&dl=1' },
  { name: '88.jpg', url: 'https://www.dropbox.com/scl/fi/uy4vk74mzj2xczclatofb/88.jpg?rlkey=k5m28x0znpn7rldc8qeh0vuve&st=khrb764d&dl=1' },
  { name: '89.jpg', url: 'https://www.dropbox.com/scl/fi/r21mn9i8oadkthvh7c3ui/89.jpg?rlkey=iqtbugm0zvo3h6dy0s72mcbz1&st=i81snve3&dl=1' },
  { name: '91.jpg', url: 'https://www.dropbox.com/scl/fi/no2c4i16f4owbd1iw38fu/91.jpg?rlkey=iji1sx6dlcdtyvem3prqplp3x&st=tnl58lh8&dl=1' },
  { name: '92.jpg', url: 'https://www.dropbox.com/scl/fi/vnat9ymfam0depxrsdauh/92.jpg?rlkey=9y0anzcopopou0qstp47w6re7&st=cb2tsioi&dl=1' },
  { name: '93.jpg', url: 'https://www.dropbox.com/scl/fi/g142hezdxuxff1en4cx88/93.jpg?rlkey=7bzcuh09d591677qliaisqbbq&st=l8qm17wn&dl=1' },
  { name: '94.jpg', url: 'https://www.dropbox.com/scl/fi/7rbmizo9vxqvywxp6fg12/94.jpg?rlkey=vwy3ktjs6opqjpxg0iag2vijt&st=wd35frkr&dl=1' },
  { name: '95.jpg', url: 'https://www.dropbox.com/scl/fi/4w14jhhoiotpvxnb340ca/95.jpg?rlkey=9nxgfoz1wywwllby2ye02e3aa&st=2hvfudv3&dl=1' },
  { name: '96.jpg', url: 'https://www.dropbox.com/scl/fi/janu7j0mw6bt0r7aez3dp/96.jpg?rlkey=rn3o7l7vbh9gc372rqgxz4qrh&st=ay3xhky4&dl=1' },
  { name: '99.jpg', url: 'https://www.dropbox.com/scl/fi/bj5us2w0pxdnlnj7ph4hg/99.jpg?rlkey=zncd6wv99v57eb4l2ewwm2155&st=i711pg0d&dl=1' },
  { name: '100.jpg', url: 'https://www.dropbox.com/scl/fi/v88eqw4zdgrgeqp2blir6/100.jpg?rlkey=i8mieste04dfl9zamk7gu6mio&st=ba02uj4h&dl=1' },
  { name: '102.jpg', url: 'https://www.dropbox.com/scl/fi/twoq8fhjpp592lry8sr3l/102.jpg?rlkey=68de8tedrsi3j8w7w5tegwfu4&st=1p0g6e0b&dl=1' },
  { name: '103.jpg', url: 'https://www.dropbox.com/scl/fi/8og95v2kx9mcdmz0h213i/103.jpg?rlkey=tnszlbitafvk5acxj9t03degv&st=ivai927t&dl=1' },
  { name: '105.jpg', url: 'https://www.dropbox.com/scl/fi/6mbrcu7o1zky1fzxuaztq/105.jpg?rlkey=gy0wu20lwrkwk4dedna3y4s3k&st=6fxiv1xm&dl=1' },
  { name: '106.jpg', url: 'https://www.dropbox.com/scl/fi/73yx3jfgkoobx3mee26uf/106.jpg?rlkey=3tqp0cfik3sy7jvdjl7y73cdd&st=pjdx9zs9&dl=1' },
  { name: '107.jpg', url: 'https://www.dropbox.com/scl/fi/0xyl73xry4wdcwfkr351x/107.jpg?rlkey=mn1lnj6d3cfhra1uv6way7558&st=dfrdod9h&dl=1' },
  { name: '108.jpg', url: 'https://www.dropbox.com/scl/fi/ciahdboxe0t73e83a2fpg/108.jpg?rlkey=map1hai8g41jjah4xxh1wk6v1&st=wo5tp0w6&dl=1' },
  { name: '109.jpg', url: 'https://www.dropbox.com/scl/fi/kvjy79uofn0kewwdh09gn/109.jpg?rlkey=rb9myhax6nqyqmui3d3bhim2i&st=qyfv4mwy&dl=1' },
  { name: '111.jpg', url: 'https://www.dropbox.com/scl/fi/71umhokrynylol1khmb3t/111.jpg?rlkey=gwxwopoq5orp4djx24q9jm0v2&st=h0ab5p5a&dl=1' },
  { name: '112.jpg', url: 'https://www.dropbox.com/scl/fi/5rh624pz91jhep0kid1uw/112.jpg?rlkey=xl3l72s7hhfae6d1sgisa6mf5&st=1fnsqo0o&dl=1' },
  { name: '113.jpg', url: 'https://www.dropbox.com/scl/fi/nd3556hdfx670rn5o99uk/113.jpg?rlkey=ntiikctjr1yy6melkc3rsuycb&st=xx36slkj&dl=1' },
  { name: '117.jpg', url: 'https://www.dropbox.com/scl/fi/ng03ix6q6g6j9o95hm4l2/117.jpg?rlkey=752k6s31xguvuh8ejwql262tl&st=yxbx9mvq&dl=1' },
  { name: '118.jpg', url: 'https://www.dropbox.com/scl/fi/wwaqpuliofttdssjzilv4/118.jpg?rlkey=pgi10g5ne3j14rjlecdy9f3k3&st=ggeenw77&dl=1' },
  { name: '140.jpg', url: 'https://www.dropbox.com/scl/fi/nd6460mm9g3p0bac1gih2/140.jpg?rlkey=636a2pg6lh2ov5pwgg5666uqz&st=ejjd60jk&dl=1' },
  { name: '141.jpg', url: 'https://www.dropbox.com/scl/fi/851m21bwg6ktm3fvw6us1/141.jpg?rlkey=wcwczrypv64vudnahq9ycnzas&st=68biuxau&dl=1' },
  { name: '142.jpg', url: 'https://www.dropbox.com/scl/fi/4ixr4nj2kpojwzn4lq7om/142.jpg?rlkey=a8uzkykia4mwqvtozvq01vy1g&st=zc5w3tmy&dl=1' },
  { name: '144.jpg', url: 'https://www.dropbox.com/scl/fi/u1cxn5d32dufzpwqdkmsg/144.jpg?rlkey=fflvfiky1k18bvhriqlfkp5k6&st=ctw7dmxx&dl=1' },
  { name: '145.jpg', url: 'https://www.dropbox.com/scl/fi/1qsgb239xj83tl421izv4/145.jpg?rlkey=70suc19p5pj1fz2gtbormfr1a&st=7tevbfvd&dl=1' },
  { name: '146.jpg', url: 'https://www.dropbox.com/scl/fi/pss9svbs33fgg2vdki84l/146.jpg?rlkey=do8ytl2deww1dpt3sic5ofslo&st=z4cmcw35&dl=1' },
  { name: '147.jpg', url: 'https://www.dropbox.com/scl/fi/2szzucg89u186ae3ne0pq/147.jpg?rlkey=ndc8v6v5k8d4e0tjynrqq2kx1&st=yxzy1bsu&dl=1' },
  { name: '148.jpg', url: 'https://www.dropbox.com/scl/fi/juw2k5r26f11q3rmgjr2x/148.jpg?rlkey=w3kgvzxmeynah91e10zr3edpy&st=vp3402bn&dl=1' },
  { name: '152.jpg', url: 'https://www.dropbox.com/scl/fi/s2mbyycg4eabukxv4dfai/152.jpg?rlkey=h9aivczl1c7jl5ob5emipgne9&st=usn761hv&dl=1' },
  { name: '154.jpg', url: 'https://www.dropbox.com/scl/fi/098909u6ww1mf3j57ptqq/154.jpg?rlkey=zlzsgq7zqxrobqsi84oueklcr&st=okzy9jr9&dl=1' },
  { name: '155.jpg', url: 'https://www.dropbox.com/scl/fi/4a2ypsqk8asjot5ssdfuq/155.jpg?rlkey=hyu9d3zjnp5otfxtculb4mp5i&st=oq16ioij&dl=1' },
  { name: '156.jpg', url: 'https://www.dropbox.com/scl/fi/joks2tinw95vvengzau13/156.jpg?rlkey=govakmupxewf1qlpej12j7ag8&st=9b8egfoe&dl=1' },
  { name: '157.jpg', url: 'https://www.dropbox.com/scl/fi/wdsx5tnhqtncbjdz62pyj/157.jpg?rlkey=df8z0sm2x2ex0d4zup12pyn94&st=15r1is32&dl=1' },
  { name: '158.jpg', url: 'https://www.dropbox.com/scl/fi/o5imqhiup6da9zik1u5kh/158.jpg?rlkey=ikgpor29h577i3n9nd5b6r5zq&st=fy2y0v5w&dl=1' },
  { name: '159.jpg', url: 'https://www.dropbox.com/scl/fi/h3jl2cht0vqbz5yri1g5b/159.jpg?rlkey=4wdi2eu5tgukp1mm7jofllg5i&st=imjvckcf&dl=1' },
  { name: '160.jpg', url: 'https://www.dropbox.com/scl/fi/ytakrxs2o2if7rf11lz74/160.jpg?rlkey=4fkwiv4g9h71jkt7sxpq5e4bf&st=i91wehna&dl=1' },
  { name: '161.jpg', url: 'https://www.dropbox.com/scl/fi/dy07h4bqpyyrrt0fd0gy7/161.jpg?rlkey=yyc1wk5an6hhpn83xvrupebj8&st=6ppsjvru&dl=1' },
  { name: '162.jpg', url: 'https://www.dropbox.com/scl/fi/mmk7vlqik8kyvj10ykn09/162.jpg?rlkey=4lr9unvsoenq483mw7wbdiurf&st=1jm0zkkh&dl=1' },
  { name: '167.jpg', url: 'https://www.dropbox.com/scl/fi/jiqyk40wh0f062qx1kl4p/167.jpg?rlkey=tkytzjtpg5mz2tgzs7gnruxu5&st=we4jtfql&dl=1' }
];

export default function StudyExplanationsScreen({ navigation }) {
  const { colors, isDark, appFontSize, hapticsEnabled } = useSettings();

  // Download States
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('');

  // Picker States
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState('book');
  const [selectedTestament, setSelectedTestament] = useState('OT');
  const [tempBookId, setTempBookId] = useState(1);
  const tempChapterRef = useRef(1);
  const [availableChapters, setAvailableChapters] = useState([]);
  const [availableVerses, setAvailableVerses] = useState([]);

  // Active Reading States
  const [activeBookId, setActiveBookId] = useState(1);
  const [activeChapter, setActiveChapter] = useState(1);
  const [activeVerse, setActiveVerse] = useState(1);
  const [readingFontSize, setReadingFontSize] = useState(appFontSize);
  
  // Data States
  const [verseData, setVerseData] = useState({ textTa: '', textEn: '' });
  const [commentaries, setCommentaries] = useState([]);
  const [sidebars, setSidebars] = useState([]);
  
  // Expandable UI States
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [isRefExpanded, setIsRefExpanded] = useState(false);

  // Translation & Speech States (Independent Per Card)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [translatingId, setTranslatingId] = useState(null);
  const [translatedText, setTranslatedText] = useState('');
  const [translationModalVisible, setTranslationModalVisible] = useState(false);

  // Modals & Viewers
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserTitle, setBrowserTitle] = useState('');
  const [fullScreenMap, setFullScreenMap] = useState(null);

  useEffect(() => { checkInstallation(); }, []);
  useEffect(() => {
    if (isDownloaded) loadVerseData();
    return () => { Speech.stop(); setIsSpeaking(false); setSpeakingId(null); };
  }, [activeBookId, activeChapter, activeVerse, isDownloaded]);

  // --- DOWNLOAD LOGIC ---
  const checkInstallation = async () => {
    try {
      const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
      setIsDownloaded(dbInfo.exists && dbInfo.size > 280000000);
    } catch (e) { setIsDownloaded(false); }
  };

  const startDownload = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsDownloading(true); setDownloadProgress(0);
    try {
      const sqliteDir = FileSystem.documentDirectory + 'SQLite';
      if (!(await FileSystem.getInfoAsync(sqliteDir)).exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      if (!(await FileSystem.getInfoAsync(MAPS_FOLDER)).exists) await FileSystem.makeDirectoryAsync(MAPS_FOLDER, { intermediates: true });

      setDownloadStatusText('Downloading Database...');
      const dbDownload = FileSystem.createDownloadResumable(DB_DIRECT_URL, DB_PATH, {}, p => setDownloadProgress((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 0.5));
      await dbDownload.downloadAsync();

      const totalMaps = MAP_FILES.length;
      for (let i = 0; i < totalMaps; i++) {
        const map = MAP_FILES[i];
        setDownloadStatusText(`Downloading Maps (${i + 1}/${totalMaps})...`);
        await FileSystem.downloadAsync(map.url, MAPS_FOLDER + map.name);
        setDownloadProgress(0.5 + ((i + 1) / totalMaps) * 0.5);
      }
      
      setDownloadProgress(1); setDownloadStatusText('Complete!');
      setTimeout(() => { setIsDownloading(false); setIsDownloaded(true); }, 1000);
    } catch (error) {
      setIsDownloading(false); Alert.alert('Error', 'Download failed.');
    }
  };

  // --- DATA LOADING LOGIC ---
  const loadVerseData = () => {
    try {
      setExpandedCardId(null);
      setIsRefExpanded(false);
      if (isSpeaking) { Speech.stop(); setIsSpeaking(false); setSpeakingId(null); }
      
      const taTable = getTableNameSync('TAMIL.db');
      const resTa = querySync('TAMIL.db', `SELECT text FROM "${taTable}" WHERE book_id=? AND chapter=? AND verse=?`, [activeBookId, activeChapter, activeVerse]);
      const enTable = getTableNameSync('KJV.db');
      const resEn = querySync('KJV.db', `SELECT text FROM "${enTable}" WHERE book_id=? AND chapter=? AND verse=?`, [activeBookId, activeChapter, activeVerse]);
      
      setVerseData({ textTa: resTa?.[0]?.text || '', textEn: resEn?.[0]?.text || '' });

      getSafeDb(DB_FILENAME);
      const commRes = querySync(DB_FILENAME, `
        SELECT c.source_title, c.content, a.name as author 
        FROM commentaries c LEFT JOIN authors a ON c.author_id = a.id 
        WHERE book_id=? AND chapter=? AND verse=?
      `, [activeBookId, activeChapter, activeVerse]);
      setCommentaries(commRes || []);

      const sideRes = querySync(DB_FILENAME, `SELECT is_map, content FROM sidebars WHERE book_id=? AND chapter=? AND verse=?`, [activeBookId, activeChapter, activeVerse]);
      setSidebars(sideRes || []);
    } catch (e) { console.log("Data Load Error", e); }
  };

  // --- HTML & HYPERLINK PARSER ---
  const handleVerseJump = (refStr) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const match = refStr.match(/([1-3]?\s?[A-Za-z]{2,})\.?\s(\d{1,3}):(\d{1,3})/);
    if (match) {
      const bookStr = match[1].trim().toLowerCase();
      const chapter = parseInt(match[2]);
      const verse = parseInt(match[3]);
      const book = booksData.find(b => b.name_en.toLowerCase().startsWith(bookStr) || b.name_ta.startsWith(bookStr));
      if (book) {
        setActiveBookId(book.id); setActiveChapter(chapter); setActiveVerse(verse);
        return;
      }
    }
    Alert.alert("Notice", "Could not locate this verse.");
  };

  const handleEgwJump = (ref) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `https://m.egwwritings.org/en/search?query=${encodeURIComponent(ref)}`;
    setBrowserUrl(url); setBrowserTitle(ref); setBrowserVisible(true);
  };

  const parseTextToComponents = (rawText) => {
    if (!rawText) return null;
    
    // 1. Clean HTML, decode entities (producing actual Greek/Hebrew chars)
    let cleanText = rawText
      .replace(/<\/?(p|br|div)[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '') 
      .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec)) 
      .replace(/&[a-z]+;/gi, ' ') 
      .replace(/\n\s*\n/g, '\n\n') 
      .trim();

    // 2. Exact match Book rules (Requires Capital letter) to prevent 'generationGenesis'
    const parts = [];
    const regex = /([1-3]?\s?[A-Z][a-z]+(?:\s[a-z]+\s[A-Z][a-z]+)?\.?\s\d{1,3}:\d{1,3}(?:-\d{1,3})?)|(\b[A-Z]{2,4}\s\d{1,3}\.\d{1,3}\b)|([\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanText)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', value: cleanText.slice(lastIndex, match.index) });
      if (match[1]) parts.push({ type: 'verse', value: match[1] });
      else if (match[2]) parts.push({ type: 'egw', value: match[2] });
      else if (match[3]) parts.push({ type: 'originalLang', value: match[3] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleanText.length) parts.push({ type: 'text', value: cleanText.slice(lastIndex) });

    // 3. Render the correctly colored & clickable links
    return parts.map((part, i) => {
      if (part.type === 'verse') {
        return <Text key={i} style={{ color: '#FFD700', fontWeight: 'bold' }} onPress={() => handleVerseJump(part.value)}>{part.value}</Text>;
      }
      if (part.type === 'egw') {
        return <Text key={i} style={{ color: '#4A90E2', fontWeight: 'bold', textDecorationLine: 'underline' }} onPress={() => handleEgwJump(part.value)}>{part.value}</Text>;
      }
      if (part.type === 'originalLang') {
        return <Text key={i} style={{ color: '#2ECC71', fontWeight: 'bold', fontSize: readingFontSize + 2 }}>{part.value}</Text>;
      }
      return <Text key={i}>{part.value}</Text>;
    });
  };

  // Dedicated parser for the 'Reference Verses' sidebar box
  const renderReferenceVerses = (content) => {
    // Splits using the strict Book Regex so words don't get swallowed
    const verseRegex = /([1-3]?\s?[A-Z][a-z]+(?:\s[a-z]+\s[A-Z][a-z]+)?\.?\s\d{1,3}:\d{1,3}(?:-\d{1,3})?)/g;
    const parts = content.split(verseRegex);
    
    return parts.map((part, index) => {
      if (!part) return null;
      if (index % 2 === 1) { 
        // It is a Verse - Render Yellow with double spaces
        return (
          <Text key={index}>
            <Text style={{ color: '#FFD700', fontWeight: 'bold' }} onPress={() => handleVerseJump(part)}>
              {part}
            </Text>
            {"   "}
          </Text>
        );
      } else { 
        // It is a Main Word (e.g. "generation" or "the son of David")
        const cleanWord = part.trim();
        if (!cleanWord) return null;
        return (
          <Text key={index} style={{ color: colors.primary, fontWeight: 'bold', fontSize: readingFontSize + 2 }}>
            {index > 0 ? `\n\n${cleanWord}\n` : `${cleanWord}\n`}
          </Text>
        );
      }
    });
  };

  // --- PICKER LOGIC (Tri-Split UI Forced to English) ---
  const getBookNameEn = (id) => booksData.find(b => b.id === id)?.name_en || '';
  const triggerHaptic = () => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const openBookPicker = () => { triggerHaptic(); setTempBookId(activeBookId); setPickerStep('book'); setIsPickerVisible(true); };
  const openChapterPicker = () => {
    triggerHaptic(); setTempBookId(activeBookId); setPickerStep('chapter');
    try {
      const table = getTableNameSync('TAMIL.db');
      const res = querySync('TAMIL.db', `SELECT MAX(chapter) as maxCh FROM "${table}" WHERE book_id = ?`, [activeBookId]);
      setAvailableChapters(Array.from({ length: res[0]?.maxCh || 1 }, (_, i) => i + 1));
      setIsPickerVisible(true);
    } catch (e) {}
  };
  const openVersePicker = () => {
    triggerHaptic(); setTempBookId(activeBookId); tempChapterRef.current = activeChapter; setPickerStep('verse');
    try {
      const table = getTableNameSync('TAMIL.db');
      const res = querySync('TAMIL.db', `SELECT MAX(verse) as maxV FROM "${table}" WHERE book_id = ? AND chapter = ?`, [activeBookId, activeChapter]);
      setAvailableVerses(Array.from({ length: res[0]?.maxV ?? 1 }, (_, i) => i + 1));
      setIsPickerVisible(true);
    } catch (e) {}
  };

  const handleBookSelect = (id) => {
    triggerHaptic(); setTempBookId(id); setPickerStep('chapter');
    try {
      const table = getTableNameSync('TAMIL.db');
      const res = querySync('TAMIL.db', `SELECT MAX(chapter) as maxCh FROM "${table}" WHERE book_id = ?`, [id]);
      setAvailableChapters(Array.from({ length: res[0]?.maxCh || 1 }, (_, i) => i + 1));
    } catch (e) {}
  };

  const handleChapterSelect = (ch) => {
    triggerHaptic(); tempChapterRef.current = ch; setPickerStep('verse');
    try {
      const table = getTableNameSync('TAMIL.db');
      const res = querySync('TAMIL.db', `SELECT MAX(verse) as maxV FROM "${table}" WHERE book_id = ? AND chapter = ?`, [tempBookId, ch]);
      setAvailableVerses(Array.from({ length: res[0]?.maxV ?? 1 }, (_, i) => i + 1));
    } catch (e) {}
  };

  // --- ACTIONS (Speech, Translate, Share) ---
  const handleSpeak = async (index, text) => {
    if (isSpeaking && speakingId === index) {
      await Speech.stop(); setIsSpeaking(false); setSpeakingId(null);
      return;
    }
    await Speech.stop();
    try {
      setIsSpeaking(true); setSpeakingId(index);
      const cleanRaw = text.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
      const voices = await Speech.getAvailableVoicesAsync();
      let voice = voices.find(v => v.language?.startsWith('en-US') && v.quality === 'Enhanced') || voices.find(v => v.language?.startsWith('en'));
      await Speech.speak(cleanRaw, {
        language: 'en-US', pitch: 1.0, rate: 0.85, ...(voice && { voice: voice.identifier }),
        onDone: () => { setIsSpeaking(false); setSpeakingId(null); },
        onError: () => { setIsSpeaking(false); setSpeakingId(null); }
      });
    } catch (e) { setIsSpeaking(false); setSpeakingId(null); }
  };

  const handleShare = async (title, text) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { 
      const cleanRaw = text.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
      await Share.share({ message: `*${title}*\n${getBookNameEn(activeBookId)} ${activeChapter}:${activeVerse}\n\n${cleanRaw}` }); 
    } catch (e) {}
  };

  const splitIntoChunks = (text, maxLen = 400) => {
    if (!text || !text.trim()) return [];
    if (text.trim().length <= maxLen) return [text.trim()];
    const sentences = text.match(/[^.!?;]+[.!?;]+/g) || [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + sentence).length > maxLen) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else { current += sentence; }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.trim().slice(0, maxLen)];
  };

  const translateChunkWithRetry = async (text, retries = 3) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const tryGoogle = async () => {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].filter(i => Array.isArray(i) && i[0]).map(i => i[0]).join('').trim();
      }
      throw new Error('Bad response');
    };
    for (let i = 0; i < retries; i++) {
      try { return await tryGoogle(); } catch (e) { await new Promise(r => setTimeout(r, 500)); }
    }
    return `[${trimmed}]`;
  };

  const handleTranslate = async (index, text) => {
    setTranslatingId(index);
    try {
      const cleanRaw = text.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
      const chunks = splitIntoChunks(cleanRaw, 400);
      const translatedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        translatedChunks.push(await translateChunkWithRetry(chunks[i], 3));
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 400));
      }
      setTranslatedText(translatedChunks.filter(Boolean).join(' '));
      setTranslationModalVisible(true);
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { Alert.alert('Translation Failed', 'Check internet connection.'); } 
    finally { setTranslatingId(null); }
  };


  // --- RENDER ---
  if (!isDownloaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}><Ionicons name="arrow-back" size={28} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: appFontSize + 4 }]}>Verse Explanations</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContent}>
          <Ionicons name="library" size={80} color={colors.primary} style={{ marginBottom: 20 }} />
          <Text style={[styles.downloadPrompt, { color: colors.text, fontSize: appFontSize + 4 }]}>
            Download Study Package
          </Text>
          <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold', marginBottom: 10 }}>
            வேதாகம விளக்க உரை பதிவிறக்கம்
          </Text>

          <Text style={[styles.downloadSub, { color: colors.subtext, fontSize: appFontSize, marginBottom: 5, textAlign: 'center' }]}>
            Includes full verse-by-verse commentaries and offline maps.
          </Text>
          <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
            வசனங்களுக்கான விளக்க உரைகள் மற்றும் வரைபடங்கள் அடங்கியுள்ளது.
          </Text>

          <View style={{ backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 15, borderRadius: 10, marginBottom: 25, marginHorizontal: 20 }}>
            <Text style={{ color: '#FF3B30', fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }}>
              ⚠️ WARNING: Do not close the app or go back while downloading!
            </Text>
            <Text style={{ color: '#FF3B30', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>
              எச்சரிக்கை: பதிவிறக்கம் செய்யும் போது செயலியை மூடவோ அல்லது பின்னால் செல்லவோ கூடாது!
            </Text>
          </View>

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <Text style={{ color: colors.primary, marginBottom: 8, fontWeight: 'bold' }}>{downloadStatusText}</Text>
              <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}><View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${downloadProgress * 100}%` }]} /></View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: colors.primary }]} onPress={startDownload}><Text style={styles.downloadBtnText}>Download Package</Text></TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      
      {/* HEADER SECTION */}
      <View style={[styles.actionHeader, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => { Speech.stop(); navigation.goBack(); }} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={styles.triSplitHeader}>
            <TouchableOpacity style={[styles.triSplitBtn, { borderColor: colors.primary, backgroundColor: colors.glow }]} onPress={openBookPicker}>
              <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold' }}>{getBookNameEn(activeBookId)}</Text>
              <Ionicons name="caret-down" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.triSplitBtn, { borderColor: colors.primary, backgroundColor: colors.glow, marginHorizontal: 6 }]} onPress={openChapterPicker}>
              <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold' }}>Ch {activeChapter}</Text>
              <Ionicons name="caret-down" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.triSplitBtn, { borderColor: colors.primary, backgroundColor: colors.glow }]} onPress={openVersePicker}>
              <Text style={{ color: colors.primary, fontSize: appFontSize, fontWeight: 'bold' }}>Vs {activeVerse}</Text>
              <Ionicons name="caret-down" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => { triggerHaptic(); setBrowserUrl(`https://bibletools.info/${BT_BOOKS[activeBookId - 1]}_${activeChapter}.${activeVerse}`); setBrowserTitle("Bible Tool.info"); setBrowserVisible(true); }} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, textDecorationLine: 'underline' }}>Visit official site - Bible Tool.info</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row' }}>
           <TouchableOpacity onPress={() => setReadingFontSize(Math.min(readingFontSize + 2, appFontSize + 8))} style={styles.iconBtn}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>A+</Text>
           </TouchableOpacity>
           <TouchableOpacity onPress={() => setReadingFontSize(Math.max(readingFontSize - 2, appFontSize - 2))} style={styles.iconBtn}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary }}>A-</Text>
           </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 15 }} showsVerticalScrollIndicator={false}>
        
        {/* 1. DUAL-LANGUAGE VERSE BOX */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: '900', fontSize: readingFontSize + 2, marginBottom: 10 }}>{verseData.textEn}</Text>
          <Text style={{ color: colors.subtext, fontSize: readingFontSize, fontFamily: 'Tamil003' }}>{verseData.textTa}</Text>
        </View>

        {/* 2. EXPANDABLE COMMENTARY CARDS */}
        {commentaries.length === 0 ? (
          <View style={{ marginTop: 40, paddingHorizontal: 20 }}>
            <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: appFontSize }}>
              No study explanations found for this verse.
            </Text>
            <Text style={{ color: colors.primary, textAlign: 'center', fontSize: appFontSize - 2, marginTop: 15, lineHeight: 22 }}>
              {`If data failed to load, go to:
Settings -> Manage Storage -> Delete Bible Verse Explanations
and redownload the file fully.`}
            </Text>
          </View>
        ) : (
          commentaries.map((comm, index) => {
            const isExpanded = expandedCardId === index;
            return (
              <TouchableOpacity 
                key={`comm-${index}`} activeOpacity={1}
                onPress={() => { triggerHaptic(); setExpandedCardId(isExpanded ? null : index); }}
                style={[styles.card, { backgroundColor: colors.card, borderColor: isExpanded ? colors.primary : colors.border }]}
              >
                {/* Header Area with Toolbars */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize }}>{comm.source_title}</Text>
                    {comm.author && <Text style={{ color: colors.subtext, fontSize: appFontSize - 2, marginTop: 2 }}>By {comm.author}</Text>}
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleSpeak(index, comm.content)} style={[styles.tinyPill, { backgroundColor: (isSpeaking && speakingId === index) ? '#000' : colors.background, borderColor: colors.border }]}>
                      <Ionicons name={(isSpeaking && speakingId === index) ? 'pause-circle' : 'volume-high'} size={16} color={(isSpeaking && speakingId === index) ? '#FF0000' : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleTranslate(index, comm.content)} disabled={translatingId !== null} style={[styles.tinyPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      {translatingId === index ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>த</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(comm.source_title, comm.content)} style={[styles.tinyPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="share-social-outline" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} style={{ marginLeft: 6 }} />
                  </View>
                </View>

                {/* Expanded Cleaned HTML Text */}
                {isExpanded && (
                  <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ color: colors.text, fontSize: readingFontSize, lineHeight: readingFontSize * 1.6 }}>
                      {parseTextToComponents(comm.content)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })
        )}

        {/* 3. SIDEBARS: REFERENCE VERSES BOX (Now Expandable and Below Commentaries) */}
        {sidebars.map((sb, idx) => {
          if (sb.is_map === 1) return null; 
          return (
            <TouchableOpacity 
              key={`ref-${idx}`} activeOpacity={1}
              onPress={() => { triggerHaptic(); setIsRefExpanded(!isRefExpanded); }}
              style={[styles.card, { backgroundColor: colors.card, borderColor: isRefExpanded ? colors.primary : colors.border }]}
            >
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: appFontSize }}>Reference Verses</Text>
                  <Ionicons name={isRefExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
               </View>
               {isRefExpanded && (
                 <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border }}>
                   <Text style={{ color: colors.text, fontSize: readingFontSize, lineHeight: readingFontSize * 1.6 }}>
                     {renderReferenceVerses(sb.content)}
                   </Text>
                 </View>
               )}
            </TouchableOpacity>
          );
        })}

        {/* 4. SIDEBARS: MAP RENDERER (Moved to the very bottom) */}
        {sidebars.map((sb, idx) => {
          if (sb.is_map !== 1) return null; 
          
          const imgName = sb.content.split('/').pop(); 
          const mapUri = `file://${MAPS_FOLDER}${imgName.endsWith('.jpg') ? imgName : imgName + '.jpg'}`;
          
          return (
            <View key={`map-${idx}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden', marginTop: 10 }]}>
              <Image source={{ uri: mapUri }} style={{ width: '100%', height: 250, resizeMode: 'cover' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.glow }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Offline Bible Map</Text>
                
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={() => setFullScreenMap(mapUri)} style={[styles.tinyPill, { width: 34, height: 34, borderColor: colors.primary, backgroundColor: colors.background }]}>
                    <Ionicons name="eye" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                     try { await Share.share({ url: mapUri, message: 'Bible Map' }); } catch(e) {}
                  }} style={[styles.tinyPill, { width: 34, height: 34, borderColor: colors.primary, backgroundColor: colors.background }]}>
                    <Ionicons name="download-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

      </ScrollView>

      {/* BIBLE PICKER INTEGRATION */}
      <BiblePickers
        visible={isPickerVisible} pickerStep={pickerStep} selectedTestament={selectedTestament}
        availableChapters={availableChapters} availableVerses={availableVerses}
        colors={colors} isDark={isDark} appFontSize={appFontSize} bibleLanguage="english" 
        onClose={() => { triggerHaptic(); setIsPickerVisible(false); }}
        onBack={() => { triggerHaptic(); setPickerStep(pickerStep === 'verse' ? 'chapter' : 'book'); }}
        onTestamentSelect={setSelectedTestament} onBookSelect={handleBookSelect} onChapterSelect={handleChapterSelect}
        onVerseSelect={(v) => { 
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium); 
          setActiveBookId(tempBookId); setActiveChapter(tempChapterRef.current); setActiveVerse(v); 
          setIsPickerVisible(false); 
        }}
      />

      {/* TRANSLATION MODAL (Solid Background) */}
      <Modal visible={translationModalVisible} animationType="fade" transparent={true} onRequestClose={() => setTranslationModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.translationCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <LinearGradient colors={['#4A90E2', '#2471C8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.translationCardTop}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Tamil Translation</Text>
              <TouchableOpacity onPress={() => setTranslationModalVisible(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </LinearGradient>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: readingFontSize, lineHeight: readingFontSize * 1.8, fontFamily: 'Tamil003' }}>
                {translatedText}
              </Text>
            </ScrollView>
            <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20 }}>
              <TouchableOpacity onPress={() => setTranslationModalVisible(false)} style={{ paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#2471C8' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: appFontSize }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN MAP ZOOM MODAL */}
      <Modal visible={!!fullScreenMap} transparent={true} animationType="fade" onRequestClose={() => setFullScreenMap(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 15, position: 'absolute', top: 40, right: 10, zIndex: 10 }}>
              <TouchableOpacity onPress={() => setFullScreenMap(null)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView maximumZoomScale={5} minimumZoomScale={1} centerContent={true} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
              <Image source={{ uri: fullScreenMap }} style={{ width: width, height: height, resizeMode: 'contain' }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <InAppBrowser visible={browserVisible} url={browserUrl} title={browserTitle} onClose={() => setBrowserVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  headerTitle: { fontWeight: 'bold' },
  iconBtn: { padding: 8 },
  downloadPrompt: { fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  downloadBtn: { paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25 },
  downloadBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  progressContainer: { width: '100%', alignItems: 'center', marginTop: 10 },
  progressBarBg: { width: '80%', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  progressBarFill: { height: '100%' },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 10, borderBottomWidth: 1 },
  triSplitHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  triSplitBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1 },
  card: { padding: 15, borderRadius: 15, borderWidth: 1, marginBottom: 15 },
  tinyPill: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 6, borderWidth: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  translationCard: { width: '100%', height: '80%', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  translationCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }
});
