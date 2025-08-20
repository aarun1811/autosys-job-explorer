--================================ 
--   Breaks Query
--================================
WITH static AS (
  SELECT
    f.mlnv,
    f.sub_acc_no,
    f.short_code,
    f.latest_stmt_date,
    f.latest_stmt_no,
    k.agent_code,
    k.local_acc_no,
    k.corr_acc_no
  FROM
    bank     k,
    message_feed f
  WHERE
      f.corr_acc_no = k.corr_acc_no
    AND k.local_acc_no = 'IE6-USD-4001843066-CITIBANK N.A NEW YORK USD'
    AND k.agent_code = 'GOA.CASH'
)
SELECT
  COUNT(*) AS breaks_count,
  s.agent_code,
  s.local_acc_no,
  i.bran_code
FROM
  item  i,
  static s
WHERE
    s.corr_acc_no = i.corr_acc_no
  AND i.flag_2 = 0
GROUP BY
  s.agent_code,
  s.local_acc_no,
  i.bran_code;

--============================================================================
--   Automatch Query
--============================================================================
 SELECT
  sys_context('USERENV', 'DB_NAME') tlm_instance,
  b.agent_code           agent_code,
  b.local_acc_no          setid,
  i.stmt_date            stmt_date,
  i.bran_code            bran_code,
  b.corr_acc_no           corr_acc_no,
  SUM(
    CASE
      WHEN i.flag_2 IN(0, 1, 11) THEN
        1
      ELSE
        0
    END
  )                 total_items,
  SUM(
    CASE
      WHEN th.last_action_owner IN('SYSTEM', 'system', 'AUTONET')
         AND i.flag_2 = 1 THEN
        1
      ELSE
        0
    END
  )                 automatch_items
FROM
  bank            b,
  message_feed        mf,
  item            i,
  tlm_bdr_relationship_header th
WHERE
    b.corr_acc_no = mf.corr_acc_no
  AND mf.corr_acc_no = i.corr_acc_no
  AND mf.short_code = i.short_no
  AND i.relationship_id = th.relationship_id (+)
  AND mf.mlnv NOT IN ( '9060', '9066' )
  AND i.stmt_date BETWEEN (
    SELECT
      trunc(sysdate) - ( decode(to_char(sysdate, 'D'), 1, 1, 2, 3,
                   3, 1, 4, 1, 5,
                   1, 6, 1, 7, 1) )
    FROM
      dual
  ) AND sysdate - 1
  AND b.local_acc_no = 'IE6-USD-4001843066-CITIBANK N.A NEW YORK USD'
  AND b.agent_code = 'GOA.CASH'
GROUP BY
  b.agent_code,
  b.local_acc_no,
  i.stmt_date,
  i.bran_code,
  b.corr_acc_no
ORDER BY
  b.agent_code,
  b.local_acc_no,
  i.stmt_date,
  i.bran_code,
  b.corr_acc_no

--============================================================================
--   Manual Match Query
--============================================================================  
SELECT
  tlm_instance,
  agent_code,
  setid,
  stmt_date,
  bran_code,
  corr_acc_no,
  SUM(manual_match_count) AS total_manual_match_count
FROM
  (
    SELECT
      COUNT(*) AS manual_match_count,
      agent_code,
      setid,
      corr_acc_no,
      bran_code,
      tlm_instance,
      stmt_date
    FROM
      reconmgmt.mr_csum_man_match_details
    WHERE
      stmt_date BETWEEN TRUNC(SYSDATE) - (DECODE(TO_CHAR(SYSDATE, 'D'), 1, 1, 2, 3,
                            3, 1, 4, 1, 5,
                            1, 6, 1, 7, 1))
              AND TRUNC(SYSDATE) - 1
      AND setid = 'IE6-USD-4001843066-CITIBANK N.A NEW YORK USD'
      AND agent_code = 'GOA.CASH'
    GROUP BY
      agent_code,
      setid,
      corr_acc_no,
      bran_code,
      tlm_instance,
      stmt_date
    UNION ALL
    SELECT
      COUNT(*)   AS manual_match_count,
      agent_code,
      local_acc_no AS setid,
      corr_acc_no,
      bran_code,
      tlm_instance,
      stmt_date
    FROM
      reconmgmt.mr_csum_netting_hist
    WHERE
      stmt_date BETWEEN TRUNC(SYSDATE) - (DECODE(
  to_char(sysdate, 'D'),
  1,
  1,
  2,
  3,
  3,
  1,
  4,
  1,
  5,
  1,
  6,
  1,
  7,
  1
))
              AND TRUNC(SYSDATE) - 1
      AND local_acc_no = 'IE6-USD-4001843066-CITIBANK N.A NEW YORK USD'
      AND agent_code = 'GOA.CASH'
    GROUP BY
      agent_code,
      local_acc_no,
      corr_acc_no,
      bran_code,
      tlm_instance,
      stmt_date
  ) combined_results
GROUP BY
  agent_code,
  setid,
  corr_acc_no,
  bran_code,
  tlm_instance,
  stmt_date;